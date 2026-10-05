// Package render screenshots card HTML with a headless Chromium over CDP
// (port of server/src/services/renderer.ts).
package render

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"sync"
	"time"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/emulation"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/cdproto/runtime"
	"github.com/chromedp/chromedp"

	"cardstock/internal/config"
	"cardstock/internal/imaging"
	"cardstock/internal/store"
)

// Status is reported to the client via /api/app/status.
type Status struct {
	State    string `json:"state"` // idle | starting | downloading | ready | error
	Progress int    `json:"progress,omitempty"`
	// Indeterminate is set while downloading without progress info (the nixpkgs fetch).
	Indeterminate bool   `json:"indeterminate,omitempty"`
	Browser       string `json:"browser,omitempty"`
	Error         string `json:"error,omitempty"`
	// Target is the folder a download is going into.
	Target string `json:"target,omitempty"`
	// Downloaded describes a renderer downloaded during this run, so the UI can confirm it.
	Downloaded *Download `json:"downloaded,omitempty"`
}

type Download struct {
	Path  string `json:"path"`
	Bytes int64  `json:"bytes,omitempty"`
	// Nix is set when Path is a link into the Nix store (its size is shared with the system).
	Nix bool `json:"nix,omitempty"`
}

var (
	mu         sync.Mutex
	status     = Status{State: "idle"}
	browserCtx context.Context
	cancelAll  context.CancelFunc
	pool       chan context.Context
	poolSize   int

	pendingMu sync.Mutex
	pending   = map[string]string{} // render id → HTML served at /__render/{id}
)

func GetStatus() Status { mu.Lock(); defer mu.Unlock(); return status }

func setStatus(s Status) { mu.Lock(); status = s; mu.Unlock() }

// downloaded is set once a renderer has been downloaded by this process.
var downloaded *Download

func resolveBrowser() (string, error) {
	forceDownload := os.Getenv("CARDSTOCK_RENDERER") == "download"
	if !forceDownload {
		if p := FindChromium(); p != "" {
			return p, nil
		}
	}
	if IsNixOS() && !forceDownload {
		if p := findNixChromium(); p != "" {
			return p, nil
		}
		setStatus(Status{State: "downloading", Indeterminate: true, Target: nixChromiumLink()})
		exe, err := fetchNixChromium()
		if err == nil {
			downloaded = &Download{Path: nixChromiumLink(), Nix: true}
		}
		return exe, err
	}
	if p := findDownloaded(); p != "" {
		return p, nil
	}
	target := HeadlessShellDir()
	setStatus(Status{State: "downloading", Target: target})
	exe, err := downloadHeadlessShell(func(pct int) {
		setStatus(Status{State: "downloading", Progress: pct, Target: target})
	})
	if err == nil {
		downloaded = &Download{Path: target, Bytes: DirSize(target)}
	}
	return exe, err
}

// ensure starts the headless browser if it isn't running. Caller holds launchMu.
var launchMu sync.Mutex

func ensure() error {
	launchMu.Lock()
	defer launchMu.Unlock()
	if browserCtx != nil && browserCtx.Err() == nil {
		return nil
	}
	setStatus(Status{State: "starting"})
	exe, err := resolveBrowser()
	if err != nil {
		setStatus(Status{State: "error", Error: err.Error()})
		return err
	}
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.ExecPath(exe),
		chromedp.UserDataDir(filepath.Join(HomeDir(), "render-profile")),
		chromedp.Flag("hide-scrollbars", true),
		chromedp.Flag("font-render-hinting", "none"),
	)
	if os.Getuid() == 0 {
		opts = append(opts, chromedp.NoSandbox)
	}
	actx, cancelAlloc := chromedp.NewExecAllocator(context.Background(), opts...)
	bctx, cancelBrowser := chromedp.NewContext(actx)
	if err := chromedp.Run(bctx); err != nil {
		cancelBrowser()
		cancelAlloc()
		msg := "could not start " + exe + ": " + err.Error()
		if strings.HasPrefix(exe, HeadlessShellDir()) && goruntime.GOOS == "linux" {
			msg = "the downloaded renderer could not start, probably because system libraries are missing " +
				"(this happens on NixOS and minimal installs). Install Chromium or Google Chrome, " +
				"or start Cardstock with --chrome /path/to/chromium. Details: " + err.Error()
		}
		setStatus(Status{State: "error", Error: msg})
		return errors.New(msg)
	}
	browserCtx = bctx
	cancelAll = func() { cancelBrowser(); cancelAlloc() }
	pool = make(chan context.Context, config.PagePoolSize)
	poolSize = 0
	setStatus(Status{State: "ready", Browser: exe, Downloaded: downloaded})
	log.Println("Renderer ready:", exe)
	return nil
}

func acquire() (context.Context, error) {
	if err := ensure(); err != nil {
		return nil, err
	}
	mu.Lock()
	p, bctx := pool, browserCtx
	if poolSize < config.PagePoolSize {
		select {
		case tab := <-p:
			mu.Unlock()
			return tab, nil
		default:
		}
		poolSize++
		mu.Unlock()
		tab, _ := chromedp.NewContext(bctx)
		if err := chromedp.Run(tab); err != nil {
			mu.Lock()
			poolSize--
			mu.Unlock()
			return nil, err
		}
		return tab, nil
	}
	mu.Unlock()
	select {
	case tab := <-p:
		return tab, nil
	case <-bctx.Done():
		return nil, errors.New("renderer stopped")
	}
}

func release(tab context.Context) {
	mu.Lock()
	defer mu.Unlock()
	if tab.Err() != nil {
		poolSize--
		return
	}
	select {
	case pool <- tab:
	default:
	}
}

// WarmUp starts the browser and opens the page pool in the background.
func WarmUp() {
	go func() {
		var tabs []context.Context
		for i := 0; i < config.PagePoolSize; i++ {
			tab, err := acquire()
			if err != nil {
				log.Println("Renderer warm-up failed:", err)
				return
			}
			tabs = append(tabs, tab)
		}
		for _, t := range tabs {
			release(t)
		}
		log.Printf("Renderer warm: %d pages ready", len(tabs))
	}()
}

// ServePending serves card HTML to the headless browser at /__render/{id}, so pages
// load from the server origin (relative /templates/... and /games/... URLs resolve).
func ServePending(w http.ResponseWriter, r *http.Request) {
	pendingMu.Lock()
	html, ok := pending[r.PathValue("id")]
	pendingMu.Unlock()
	if !ok {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}

func screenshot(html string, w, h int) ([]byte, error) {
	if w == 0 {
		w, h = config.CardWidthCSS, config.CardHeightCSS
	}
	for attempt := 0; ; attempt++ {
		buf, err := screenshotOnce(html, w, h)
		// Retry once if the browser died underneath us (e.g. closed externally).
		if err != nil && attempt == 0 && browserCtx != nil && browserCtx.Err() != nil {
			continue
		}
		return buf, err
	}
}

func screenshotOnce(html string, w, h int) ([]byte, error) {
	tab, err := acquire()
	if err != nil {
		return nil, err
	}
	defer release(tab)

	id := store.NewUUID()
	pendingMu.Lock()
	pending[id] = html
	pendingMu.Unlock()
	defer func() { pendingMu.Lock(); delete(pending, id); pendingMu.Unlock() }()

	ctx, cancel := context.WithTimeout(tab, 60*time.Second)
	defer cancel()
	var buf []byte
	err = chromedp.Run(ctx,
		emulation.SetDeviceMetricsOverride(int64(w), int64(h), config.RenderScale, false),
		emulation.SetDefaultBackgroundColorOverride().WithColor(&cdp.RGBA{R: 0, G: 0, B: 0, A: 0}),
		chromedp.Navigate(fmt.Sprintf("http://127.0.0.1:%d/__render/%s", config.Port(), id)),
		chromedp.ActionFunc(func(ctx context.Context) error {
			_, exc, err := runtime.Evaluate("document.fonts.ready.then(() => true)").WithAwaitPromise(true).Do(ctx)
			if exc != nil {
				return errors.New(exc.Text)
			}
			return err
		}),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			buf, err = page.CaptureScreenshot().
				WithFormat(page.CaptureScreenshotFormatPng).
				WithClip(&page.Viewport{X: 0, Y: 0, Width: float64(w), Height: float64(h), Scale: 1}).
				WithFromSurface(true).
				Do(ctx)
			return err
		}),
	)
	return buf, err
}

// CardToPNG renders HTML to a PNG at 300 DPI (for export).
func CardToPNG(html string, w, h int) ([]byte, error) {
	buf, err := screenshot(html, w, h)
	if err != nil {
		return nil, err
	}
	return imaging.SetPNGDPI(buf, config.TargetDPI)
}

// CardToDataURL renders a preview and returns a base64 data URL.
func CardToDataURL(html string, w, h int) (string, error) {
	buf, err := screenshot(html, w, h)
	if err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf), nil
}

// Close shuts down the headless browser.
func Close() {
	launchMu.Lock()
	defer launchMu.Unlock()
	if cancelAll != nil {
		cancelAll()
		cancelAll, browserCtx = nil, nil
	}
}
