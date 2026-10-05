// Package config holds rendering constants (mirrors shared/src/constants.ts)
// and the mutable data-root paths used by every other package.
package config

import (
	"math"
	"path/filepath"
	"sync"
)

const (
	RenderScale      = 3
	TargetDPI        = 300
	CardWidthInches  = 2.5
	CardHeightInches = 3.5
	CardWidthCSS     = 250
	CardHeightCSS    = 350
	CardWidthPx      = CardWidthCSS * RenderScale
	CardHeightPx     = CardHeightCSS * RenderScale

	TTSMaxColumns = 10
	TTSMaxRows    = 7

	CropMarkLength = 18.0 // points (0.25 inch)
	PDFMargin      = 36.0 // points (0.5 inch)

	DefaultPort  = 3001
	PagePoolSize = 4
)

type PageSize struct{ Width, Height float64 }

var PDFPageSizes = map[string]PageSize{
	"letter": {612, 792},
	"a4":     {595.28, 841.89},
}

type preset struct{ Width, Height float64 }

var CardSizePresets = map[string]preset{
	"poker":  {2.5, 3.5},
	"bridge": {2.25, 3.5},
	"tarot":  {2.75, 4.75},
}

type Dims struct {
	WidthInches, HeightInches float64
	WidthCSS, HeightCSS       int
	WidthPx, HeightPx         int
}

// ResolveCardDimensions mirrors resolveCardDimensions in shared/src/constants.ts.
func ResolveCardDimensions(w, h float64, landscape bool) Dims {
	if landscape && h > w {
		w, h = h, w
	}
	return Dims{
		WidthInches:  w,
		HeightInches: h,
		WidthCSS:     int(math.Round(w * 100)),
		HeightCSS:    int(math.Round(h * 100)),
		WidthPx:      int(math.Round(w * 100 * RenderScale)),
		HeightPx:     int(math.Round(h * 100 * RenderScale)),
	}
}

// ResolveDeckDims applies a size preset (or custom size) to get card dimensions.
func ResolveDeckDims(preset string, customW, customH *float64, landscape *bool) Dims {
	w, h := CardWidthInches, CardHeightInches
	if p, ok := CardSizePresets[preset]; ok {
		w, h = p.Width, p.Height
	} else if preset == "custom" && customW != nil && customH != nil && *customW != 0 && *customH != 0 {
		w, h = *customW, *customH
	}
	return ResolveCardDimensions(w, h, landscape != nil && *landscape)
}

var (
	mu   sync.RWMutex
	root string
	port = DefaultPort
)

func SetRoot(r string) { mu.Lock(); root = r; mu.Unlock() }
func Root() string     { mu.RLock(); defer mu.RUnlock(); return root }
func SetPort(p int)    { mu.Lock(); port = p; mu.Unlock() }
func Port() int        { mu.RLock(); defer mu.RUnlock(); return port }

func GamesDir() string     { return filepath.Join(Root(), "games") }
func OutputDir() string    { return filepath.Join(Root(), "output") }
func TemplatesDir() string { return filepath.Join(Root(), "templates") }
