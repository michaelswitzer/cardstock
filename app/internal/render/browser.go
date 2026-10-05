package render

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// FindChromium returns the first installed Chromium-family browser, or "".
// Honors CARDSTOCK_CHROME (also settable via the --chrome flag).
func FindChromium() string {
	if p := os.Getenv("CARDSTOCK_CHROME"); p != "" {
		return p
	}
	var candidates []string
	switch runtime.GOOS {
	case "windows":
		var roots []string
		for _, env := range []string{"ProgramFiles", "ProgramFiles(x86)", "LocalAppData"} {
			if v := os.Getenv(env); v != "" {
				roots = append(roots, v)
			}
		}
		for _, r := range roots {
			candidates = append(candidates,
				filepath.Join(r, `Google\Chrome\Application\chrome.exe`),
				filepath.Join(r, `Microsoft\Edge\Application\msedge.exe`),
				filepath.Join(r, `BraveSoftware\Brave-Browser\Application\brave.exe`),
				filepath.Join(r, `Chromium\Application\chrome.exe`),
				filepath.Join(r, `Vivaldi\Application\vivaldi.exe`),
			)
		}
	case "darwin":
		home, _ := os.UserHomeDir()
		for _, base := range []string{"/Applications", filepath.Join(home, "Applications")} {
			for _, app := range [][2]string{
				{"Google Chrome", "Google Chrome"},
				{"Chromium", "Chromium"},
				{"Microsoft Edge", "Microsoft Edge"},
				{"Brave Browser", "Brave Browser"},
				{"Vivaldi", "Vivaldi"},
			} {
				candidates = append(candidates, filepath.Join(base, app[0]+".app", "Contents", "MacOS", app[1]))
			}
		}
	default:
		for _, name := range []string{"google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
			"microsoft-edge", "microsoft-edge-stable", "brave-browser", "brave", "vivaldi"} {
			if p, err := exec.LookPath(name); err == nil {
				candidates = append(candidates, p)
			}
		}
	}
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	return ""
}

var homeDir string

// SetHomeDir sets where downloaded browsers and browser profiles live
// (the portable renderer/ folder next to the app, when there is one).
func SetHomeDir(dir string) { homeDir = dir }

// HomeDir is where downloaded browsers and browser profiles live. It defaults to
// the per-user cache folder when the app isn't running from a writable folder.
func HomeDir() string {
	if homeDir != "" {
		return homeDir
	}
	dir, err := os.UserCacheDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "cardstock")
}

// IsNixOS reports whether we're on NixOS, where prebuilt Linux binaries such as
// chrome-headless-shell can't find their libraries.
func IsNixOS() bool {
	_, err := os.Stat("/etc/NIXOS")
	return err == nil
}

// nixChromiumLink is a nix out-link (and GC root) to a Chromium fetched from nixpkgs.
func nixChromiumLink() string { return filepath.Join(HomeDir(), "chromium") }

func findNixChromium() string {
	exe := filepath.Join(nixChromiumLink(), "bin", "chromium")
	if _, err := os.Stat(exe); err == nil {
		return exe
	}
	return ""
}

// fetchNixChromium builds nixpkgs#chromium (normally a binary-cache download) and links
// it into the renderer folder, which also keeps it from being garbage-collected.
func fetchNixChromium() (string, error) {
	nix, err := exec.LookPath("nix")
	if err != nil {
		return "", errors.New("no Chromium-based browser found. On NixOS, add chromium to your packages")
	}
	if err := os.MkdirAll(HomeDir(), 0o755); err != nil {
		return "", err
	}
	log.Println("Fetching Chromium from nixpkgs into", nixChromiumLink())
	out, err := exec.Command(nix, "--extra-experimental-features", "nix-command flakes",
		"build", "--out-link", nixChromiumLink(), "nixpkgs#chromium").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("could not fetch Chromium with nix (add chromium to your packages instead): %v: %s", err, strings.TrimSpace(string(out)))
	}
	if exe := findNixChromium(); exe != "" {
		return exe, nil
	}
	return "", errors.New("nix build finished but chromium binary not found")
}

// DirSize returns the total size of files under dir.
func DirSize(dir string) int64 {
	var total int64
	filepath.WalkDir(dir, func(_ string, d os.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			if info, err := d.Info(); err == nil {
				total += info.Size()
			}
		}
		return nil
	})
	return total
}

// HeadlessShellDir is where chrome-headless-shell downloads are unpacked.
func HeadlessShellDir() string { return filepath.Join(HomeDir(), "chrome-headless-shell") }

func cftPlatform() string {
	switch runtime.GOOS + "/" + runtime.GOARCH {
	case "linux/amd64":
		return "linux64"
	case "darwin/arm64":
		return "mac-arm64"
	case "darwin/amd64":
		return "mac-x64"
	case "windows/amd64":
		return "win64"
	case "windows/386":
		return "win32"
	}
	return ""
}

func headlessShellExe(dir, platform string) string {
	exe := "chrome-headless-shell"
	if runtime.GOOS == "windows" {
		exe += ".exe"
	}
	return filepath.Join(dir, "chrome-headless-shell-"+platform, exe)
}

// findDownloaded returns a previously downloaded headless shell, if any.
func findDownloaded() string {
	platform := cftPlatform()
	base := HeadlessShellDir()
	entries, err := os.ReadDir(base)
	if err != nil || platform == "" {
		return ""
	}
	for i := len(entries) - 1; i >= 0; i-- {
		exe := headlessShellExe(filepath.Join(base, entries[i].Name()), platform)
		if _, err := os.Stat(exe); err == nil {
			return exe
		}
	}
	return ""
}

// downloadHeadlessShell fetches the current stable chrome-headless-shell from
// Chrome for Testing into the renderer folder, reporting progress (0-100).
func downloadHeadlessShell(progress func(int)) (string, error) {
	platform := cftPlatform()
	if platform == "" {
		return "", fmt.Errorf("no Chromium-based browser found, and no downloadable renderer exists for %s/%s; install Chromium or Chrome", runtime.GOOS, runtime.GOARCH)
	}
	resp, err := http.Get("https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json")
	if err != nil {
		return "", err
	}
	var manifest struct {
		Channels map[string]struct {
			Version   string `json:"version"`
			Downloads map[string][]struct {
				Platform string `json:"platform"`
				URL      string `json:"url"`
			} `json:"downloads"`
		} `json:"channels"`
	}
	err = json.NewDecoder(resp.Body).Decode(&manifest)
	resp.Body.Close()
	if err != nil {
		return "", err
	}
	stable := manifest.Channels["Stable"]
	url := ""
	for _, d := range stable.Downloads["chrome-headless-shell"] {
		if d.Platform == platform {
			url = d.URL
		}
	}
	if url == "" {
		return "", fmt.Errorf("chrome-headless-shell not available for %s", platform)
	}
	log.Printf("Downloading renderer %s from %s", stable.Version, url)

	base := HeadlessShellDir()
	if err := os.MkdirAll(base, 0o755); err != nil {
		return "", err
	}
	tmp, err := os.CreateTemp(base, "download-*.zip")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()

	resp, err = http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("download failed: %s", resp.Status)
	}
	pw := &progressWriter{total: resp.ContentLength, fn: progress}
	if _, err := io.Copy(io.MultiWriter(tmp, pw), resp.Body); err != nil {
		return "", err
	}

	dest := filepath.Join(base, stable.Version)
	staging := dest + ".partial"
	os.RemoveAll(staging)
	if err := unzip(tmp.Name(), staging); err != nil {
		return "", err
	}
	os.RemoveAll(dest)
	if err := os.Rename(staging, dest); err != nil {
		return "", err
	}
	return headlessShellExe(dest, platform), nil
}

type progressWriter struct {
	total, done int64
	last        int
	fn          func(int)
}

func (p *progressWriter) Write(b []byte) (int, error) {
	p.done += int64(len(b))
	if p.total > 0 {
		if pct := int(p.done * 100 / p.total); pct != p.last {
			p.last = pct
			p.fn(pct)
		}
	}
	return len(b), nil
}

func unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()
	for _, f := range r.File {
		target := filepath.Join(dest, f.Name)
		if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("illegal path in zip: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			os.MkdirAll(target, 0o755)
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		if f.Mode()&os.ModeSymlink != 0 {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			link, _ := io.ReadAll(rc)
			rc.Close()
			if err := os.Symlink(string(link), target); err != nil {
				return err
			}
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, f.Mode().Perm()|0o600)
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		rc.Close()
		out.Close()
		if err != nil {
			return err
		}
	}
	return nil
}
