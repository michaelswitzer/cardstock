// Command cardstock is the standalone Cardstock app: an HTTP server with the React UI
// embedded, which renders cards through a headless Chromium and opens its UI in a browser.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"cardstock/internal/api"
	"cardstock/internal/config"
	"cardstock/internal/launcher"
	"cardstock/internal/render"
	"cardstock/internal/store"
)

// version is set at release time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	dataFlag := flag.String("data", "", "data folder (games, templates, output); default: next to the executable")
	portFlag := flag.Int("port", 0, "port to listen on (default: first free port from 3001)")
	uiFlag := flag.String("ui", "auto", "how to open the UI: auto | app | browser | none")
	noExit := flag.Bool("no-exit", false, "keep running after the UI is closed (development)")
	chromeFlag := flag.String("chrome", "", "path to a Chromium-based browser used for rendering")
	showVersion := flag.Bool("version", false, "print the version and exit")
	flag.Parse()
	if *showVersion {
		fmt.Println("Cardstock", version)
		return
	}

	if *chromeFlag != "" {
		os.Setenv("CARDSTOCK_CHROME", *chromeFlag)
	}

	// Keep downloaded renderers with the app when it runs from a writable folder (portable mode).
	if dir := portableDir(); dir != "" {
		render.SetHomeDir(filepath.Join(dir, "renderer"))
	}
	// On NixOS, an inherited LD_LIBRARY_PATH (e.g. from a dev shell) can break nixpkgs Chromium,
	// and nix-built programs never need it.
	if render.IsNixOS() {
		os.Unsetenv("LD_LIBRARY_PATH")
	}

	root, err := resolveDataRoot(*dataFlag)
	if err != nil {
		fatal(err)
	}
	if err := setupDataFolder(root); err != nil {
		fatal(err)
	}
	config.SetRoot(root)
	setupLogging(root)

	// Single instance per data folder: if one is already running, just show its UI.
	if url, ok := runningInstance(root); ok {
		log.Println("Cardstock is already running at", url)
		if _, err := launcher.OpenUI(url, *uiFlag); err != nil {
			fatal(err)
		}
		return
	}

	if err := store.Migrate(); err != nil {
		log.Println("Migration check failed:", err)
	}

	ln, err := listen(*portFlag)
	if err != nil {
		fatal(err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	config.SetPort(port)
	url := fmt.Sprintf("http://127.0.0.1:%d", port)
	os.WriteFile(filepath.Join(root, ".cardstock-port"), []byte(strconv.Itoa(port)), 0o644)

	watchdog := launcher.NewWatchdog(3*time.Minute, 90*time.Second, 12*time.Second)
	client, _ := fs.Sub(webFS, "web/dist")
	srv := &http.Server{Handler: api.New(client, api.Hooks{
		Heartbeat:         watchdog.Beat,
		Bye:               watchdog.Bye,
		SwitchDataFolder:  switchDataFolder,
		DefaultDataFolder: defaultDataFolder,
		PickFolder:        launcher.PickFolder,
		OpenPath:          launcher.OpenPath,
	})}
	go func() {
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			fatal(err)
		}
	}()
	log.Printf("Cardstock %s server running on %s", version, url)
	log.Println("Data folder:", root)
	render.WarmUp()

	uiDone, err := launcher.OpenUI(url, *uiFlag)
	if err != nil {
		log.Println("Could not open UI:", err, "- open", url, "in a browser")
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	idle := make(chan struct{})
	if !*noExit && *uiFlag != "none" {
		go func() { watchdog.Wait(); close(idle) }()
		if uiDone != nil {
			go func() { <-uiDone; watchdog.Bye() }()
		}
	}
	select {
	case <-stop:
	case <-idle:
	}

	log.Println("Shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	render.Close()
	os.Remove(filepath.Join(root, ".cardstock-port"))
}

func fatal(err error) {
	log.Println("Fatal:", err)
	if runtime.GOOS == "windows" {
		// No console in the GUI build; surface the error somewhere visible.
		launcher.ShowError("Cardstock", err.Error())
	}
	os.Exit(1)
}

// listen binds the requested port, or the first free port from 3001.
func listen(port int) (net.Listener, error) {
	if port != 0 {
		return net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	}
	for p := config.DefaultPort; p < config.DefaultPort+20; p++ {
		if ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p)); err == nil {
			return ln, nil
		}
	}
	return net.Listen("tcp", "127.0.0.1:0")
}

func runningInstance(root string) (string, bool) {
	b, err := os.ReadFile(filepath.Join(root, ".cardstock-port"))
	if err != nil {
		return "", false
	}
	url := "http://127.0.0.1:" + strings.TrimSpace(string(b))
	c := http.Client{Timeout: time.Second}
	resp, err := c.Get(url + "/api/app/info")
	if err != nil {
		return "", false
	}
	defer resp.Body.Close()
	var info struct{ DataFolder string }
	if json.NewDecoder(resp.Body).Decode(&info) != nil || info.DataFolder != root {
		return "", false
	}
	return url, true
}

// --- Data folder ---

type savedConfig struct {
	DataFolder string `json:"dataFolder"`
}

func configPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "cardstock", "config.json")
}

func loadSavedFolder() string {
	var c savedConfig
	if b, err := os.ReadFile(configPath()); err == nil && json.Unmarshal(b, &c) == nil {
		return c.DataFolder
	}
	return ""
}

func saveFolder(folder string) error {
	p := configPath()
	if p == "" {
		return errors.New("no user config directory")
	}
	os.MkdirAll(filepath.Dir(p), 0o755)
	b, _ := json.MarshalIndent(savedConfig{folder}, "", "  ")
	return os.WriteFile(p, b, 0o644)
}

// portableDir is the folder next to the executable (or next to Cardstock.app on macOS),
// or "" when that isn't a sensible or writable place for data.
func portableDir() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	dir := filepath.Dir(exe)
	if strings.Contains(dir, "go-build") {
		return "" // `go run` temp dir
	}
	if runtime.GOOS == "darwin" && filepath.Base(dir) == "MacOS" && strings.HasSuffix(filepath.Dir(filepath.Dir(dir)), ".app") {
		dir = filepath.Dir(filepath.Dir(filepath.Dir(dir)))
	}
	if runtime.GOOS == "darwin" {
		home, _ := os.UserHomeDir()
		if dir == "/Applications" || dir == filepath.Join(home, "Applications") {
			return "" // installed like a normal Mac app: keep data out of Applications
		}
	}
	if strings.Contains(dir, "/AppTranslocation/") || !writable(dir) {
		return ""
	}
	return dir
}

func writable(dir string) bool {
	f, err := os.CreateTemp(dir, ".cardstock-write-test-*")
	if err != nil {
		return false
	}
	f.Close()
	os.Remove(f.Name())
	return true
}

func defaultDataFolder() string {
	if d := portableDir(); d != "" {
		return d
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Documents", "Cardstock")
}

func resolveDataRoot(flagValue string) (string, error) {
	folder := flagValue
	if folder == "" {
		folder = loadSavedFolder()
	}
	if folder == "" {
		folder = defaultDataFolder()
	}
	return filepath.Abs(folder)
}

func setupDataFolder(folder string) error {
	for _, sub := range []string{"games", "output", "templates"} {
		if err := os.MkdirAll(filepath.Join(folder, sub), 0o755); err != nil {
			return err
		}
	}
	return seedTemplates(filepath.Join(folder, "templates"))
}

// seedTemplates copies the bundled templates unless the folder already has user templates.
func seedTemplates(dest string) error {
	entries, err := os.ReadDir(dest)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if e.IsDir() {
			return nil
		}
	}
	return fs.WalkDir(templatesFS, "templates", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		target := filepath.Join(dest, filepath.FromSlash(strings.TrimPrefix(p, "templates")))
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		if _, err := os.Stat(target); err == nil {
			return nil
		}
		b, err := templatesFS.ReadFile(p)
		if err != nil {
			return err
		}
		return os.WriteFile(target, b, 0o644)
	})
}

func switchDataFolder(folder string) error {
	abs, err := filepath.Abs(folder)
	if err != nil {
		return err
	}
	if err := setupDataFolder(abs); err != nil {
		return err
	}
	old := config.Root()
	os.Remove(filepath.Join(old, ".cardstock-port"))
	config.SetRoot(abs)
	os.WriteFile(filepath.Join(abs, ".cardstock-port"), []byte(strconv.Itoa(config.Port())), 0o644)
	if err := store.Migrate(); err != nil {
		log.Println("Migration check failed:", err)
	}
	setupLogging(abs)
	log.Println("Data folder:", abs)
	return saveFolder(abs)
}

var logFile *os.File

func setupLogging(root string) {
	f, err := os.Create(filepath.Join(root, "cardstock.log"))
	if err != nil {
		return
	}
	if logFile != nil {
		logFile.Close()
	}
	logFile = f
	var w io.Writer = f
	if _, err := os.Stdout.Stat(); err == nil { // false in the Windows GUI build (no console)
		w = io.MultiWriter(f, os.Stdout)
	}
	log.SetOutput(w)
}
