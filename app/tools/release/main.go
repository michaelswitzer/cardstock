// Command release cross-compiles Cardstock for every platform and packages
// unzip-and-run archives into app/dist/. Run from app/: go run ./tools/release -version 0.2.0
// The client must already be built into web/dist (npm run build does this).
package main

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"encoding/json"
	"flag"
	"fmt"
	"image"
	"image/png"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	xdraw "golang.org/x/image/draw"
)

type target struct {
	goos, goarch, label string
}

var targets = []target{
	{"windows", "amd64", "windows-x64"},
	{"darwin", "arm64", "macos-arm64"},
	{"darwin", "amd64", "macos-x64"},
	{"linux", "amd64", "linux-x64"},
	{"linux", "arm64", "linux-arm64"},
}

// file is one entry in a release archive.
type file struct {
	name string
	data []byte
	exec bool
}

func main() {
	version := flag.String("version", "", "version embedded in the binary and archive names (default: package.json version)")
	only := flag.String("only", "", "build only targets whose label contains this (e.g. linux)")
	host := flag.Bool("host", false, "just build ./cardstock for this machine (no archives)")
	flag.Parse()
	log.SetFlags(0)
	if *version == "" {
		var pkg struct{ Version string }
		json.Unmarshal(must(os.ReadFile("../package.json")), &pkg)
		*version = pkg.Version
	}

	if _, err := os.Stat("web/dist/index.html"); err != nil {
		log.Fatal("web/dist/index.html missing: run `npm run build` from the repo root first")
	}
	if *host {
		name := "cardstock"
		if runtime.GOOS == "windows" {
			name += ".exe"
		}
		bin := build(target{runtime.GOOS, runtime.GOARCH, "host"}, *version)
		if err := os.WriteFile(name, bin, 0o755); err != nil {
			log.Fatal(err)
		}
		log.Printf("built app/%s (%.1f MB)", name, mb(len(bin)))
		return
	}
	os.MkdirAll("dist", 0o755)
	macIcon := must(os.ReadFile("assets/icon-mac.png"))

	for _, t := range targets {
		if *only != "" && !strings.Contains(t.label, *only) {
			continue
		}
		bin := build(t, *version)
		base := fmt.Sprintf("Cardstock-%s-%s", *version, t.label)
		var out string
		switch t.goos {
		case "windows":
			out = writeZip(base, []file{{"Cardstock/Cardstock.exe", bin, true}})
		case "darwin":
			out = writeZip(base, []file{
				{"Cardstock/Cardstock.app/Contents/Info.plist", infoPlist(*version), false},
				{"Cardstock/Cardstock.app/Contents/MacOS/cardstock", bin, true},
				{"Cardstock/Cardstock.app/Contents/Resources/icon.icns", icns(macIcon), false},
			})
		default:
			out = writeTarGz(base, []file{{"Cardstock/cardstock", bin, true}})
		}
		st, _ := os.Stat(out)
		log.Printf("%-14s binary %5.1f MB   archive %5.1f MB   %s", t.label, mb(len(bin)), mb(int(st.Size())), out)
	}
}

func build(t target, version string) []byte {
	out := filepath.Join(os.TempDir(), fmt.Sprintf("cardstock-%s-%d", t.label, time.Now().UnixNano()))
	defer os.Remove(out)
	ldflags := "-s -w -X main.version=" + version
	if t.goos == "windows" {
		ldflags += " -H=windowsgui"
		// Embed the icon and version info as a Windows resource (.syso is linked automatically).
		run(nil, "go", "run", "github.com/tc-hib/go-winres@v0.3.3", "simply",
			"--arch", t.goarch, "--icon", "assets/icon.png", "--manifest", "gui",
			"--product-name", "Cardstock", "--file-description", "Cardstock",
			"--product-version", winVersion(version), "--file-version", winVersion(version))
		defer func() {
			matches, _ := filepath.Glob("rsrc_windows_*.syso")
			for _, m := range matches {
				os.Remove(m)
			}
		}()
	}
	env := append(os.Environ(), "GOOS="+t.goos, "GOARCH="+t.goarch, "CGO_ENABLED=0")
	run(env, "go", "build", "-trimpath", "-ldflags", ldflags, "-o", out, ".")
	return must(os.ReadFile(out))
}

// winVersion turns "0.2.0" or "dev" into the a.b.c.d form Windows resources require.
func winVersion(v string) string {
	parts := strings.Split(strings.TrimPrefix(v, "v"), ".")
	nums := []string{"0", "0", "0", "0"}
	for i := 0; i < len(parts) && i < 4; i++ {
		var n int
		if _, err := fmt.Sscanf(parts[i], "%d", &n); err == nil {
			nums[i] = fmt.Sprint(n)
		}
	}
	return strings.Join(nums, ".")
}

func run(env []string, name string, args ...string) {
	cmd := exec.Command(name, args...)
	cmd.Env = env
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		log.Fatalf("%s %s: %v", name, strings.Join(args, " "), err)
	}
}

func writeZip(base string, files []file) string {
	path := filepath.Join("dist", base+".zip")
	f := must(os.Create(path))
	defer f.Close()
	zw := zip.NewWriter(f)
	for _, fl := range files {
		h := &zip.FileHeader{Name: fl.name, Method: zip.Deflate, Modified: time.Now()}
		mode := os.FileMode(0o644)
		if fl.exec {
			mode = 0o755
		}
		h.SetMode(mode)
		w := must(zw.CreateHeader(h))
		w.Write(fl.data)
	}
	if err := zw.Close(); err != nil {
		log.Fatal(err)
	}
	return path
}

func writeTarGz(base string, files []file) string {
	path := filepath.Join("dist", base+".tar.gz")
	f := must(os.Create(path))
	defer f.Close()
	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)
	for _, fl := range files {
		mode := int64(0o644)
		if fl.exec {
			mode = 0o755
		}
		tw.WriteHeader(&tar.Header{Name: fl.name, Mode: mode, Size: int64(len(fl.data)), ModTime: time.Now(), Typeflag: tar.TypeReg})
		tw.Write(fl.data)
	}
	tw.Close()
	gz.Close()
	return path
}

func infoPlist(version string) []byte {
	return []byte(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key><string>Cardstock</string>
	<key>CFBundleDisplayName</key><string>Cardstock</string>
	<key>CFBundleIdentifier</key><string>com.cardstock.app</string>
	<key>CFBundleExecutable</key><string>cardstock</string>
	<key>CFBundleIconFile</key><string>icon</string>
	<key>CFBundlePackageType</key><string>APPL</string>
	<key>CFBundleVersion</key><string>` + version + `</string>
	<key>CFBundleShortVersionString</key><string>` + version + `</string>
	<key>LSMinimumSystemVersion</key><string>11.0</string>
	<!-- The UI is a browser window; the app itself has no Dock icon or menu bar. -->
	<key>LSUIElement</key><true/>
	<key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`)
}

// icns builds a macOS icon file from a PNG, with PNG-encoded entries at the standard sizes.
func icns(src []byte) []byte {
	img, err := png.Decode(bytes.NewReader(src))
	if err != nil {
		log.Fatal(err)
	}
	var body bytes.Buffer
	for _, e := range []struct {
		typ  string
		size int
	}{{"ic10", 1024}, {"ic09", 512}, {"ic08", 256}, {"ic07", 128}} {
		dst := image.NewNRGBA(image.Rect(0, 0, e.size, e.size))
		xdraw.CatmullRom.Scale(dst, dst.Bounds(), img, img.Bounds(), xdraw.Src, nil)
		var p bytes.Buffer
		png.Encode(&p, dst)
		body.WriteString(e.typ)
		binary.Write(&body, binary.BigEndian, uint32(8+p.Len()))
		io.Copy(&body, &p)
	}
	var out bytes.Buffer
	out.WriteString("icns")
	binary.Write(&out, binary.BigEndian, uint32(8+body.Len()))
	io.Copy(&out, &body)
	return out.Bytes()
}

func mb(n int) float64 { return float64(n) / (1 << 20) }

func must[T any](v T, err error) T {
	if err != nil {
		log.Fatal(err)
	}
	return v
}
