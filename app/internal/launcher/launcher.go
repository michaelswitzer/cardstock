// Package launcher replaces the Electron shell: it opens the UI window,
// shows native folder pickers and shuts the app down when the UI goes away.
package launcher

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"cardstock/internal/render"
)

// OpenPath opens a folder (or file/URL) with the OS default handler.
func OpenPath(p string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", p)
	case "darwin":
		cmd = exec.Command("open", p)
	default:
		cmd = exec.Command("xdg-open", p)
	}
	return cmd.Start()
}

// OpenUI opens the app UI. mode is "app" (Chromium --app window), "browser"
// (default browser) or "auto" (app window when a Chromium-family browser exists).
// It returns a channel that is closed when an app-mode window process exits,
// or nil when the UI's lifetime can only be tracked by heartbeats.
func OpenUI(url, mode string) (<-chan struct{}, error) {
	if mode == "none" {
		return nil, nil
	}
	if mode == "auto" || mode == "app" {
		if exe := render.FindChromium(); exe != "" {
			profile := filepath.Join(render.HomeDir(), "ui-profile")
			cmd := exec.Command(exe,
				"--app="+url,
				"--user-data-dir="+profile,
				"--no-first-run",
				"--no-default-browser-check",
				"--window-size=1400,900",
			)
			if err := cmd.Start(); err == nil {
				done := make(chan struct{})
				go func() { cmd.Wait(); close(done) }()
				return done, nil
			} else if mode == "app" {
				return nil, err
			}
		} else if mode == "app" {
			return nil, errors.New("no Chromium-based browser found for --ui=app")
		}
	}
	return nil, OpenPath(url)
}

// PickFolder shows a native folder chooser.
func PickFolder() (string, error) {
	var out []byte
	var err error
	switch runtime.GOOS {
	case "darwin":
		out, err = exec.Command("osascript", "-e",
			`POSIX path of (choose folder with prompt "Choose Cardstock Data Folder")`).Output()
	case "windows":
		script := `Add-Type -AssemblyName System.Windows.Forms;` +
			`$f = New-Object System.Windows.Forms.FolderBrowserDialog;` +
			`$f.Description = 'Choose Cardstock Data Folder';` +
			`$f.ShowNewFolderButton = $true;` +
			`$owner = New-Object System.Windows.Forms.Form -Property @{TopMost=$true};` +
			`if ($f.ShowDialog($owner) -eq 'OK') { $f.SelectedPath }`
		cmd := exec.Command("powershell", "-NoProfile", "-STA", "-Command", script)
		hideWindow(cmd)
		out, err = cmd.Output()
	default:
		if p, lerr := exec.LookPath("zenity"); lerr == nil {
			out, err = exec.Command(p, "--file-selection", "--directory", "--title=Choose Cardstock Data Folder").Output()
		} else if p, lerr := exec.LookPath("kdialog"); lerr == nil {
			out, err = exec.Command(p, "--getexistingdirectory", os.Getenv("HOME"), "--title", "Choose Cardstock Data Folder").Output()
		} else {
			return "", errors.New("no native folder picker available (install zenity or kdialog)")
		}
	}
	path := strings.TrimSpace(string(out))
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) || (err == nil && path == "") {
		return "", nil // user cancelled
	}
	if err != nil {
		return "", err
	}
	return strings.TrimRight(path, `/\`), nil
}
