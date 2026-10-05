// Package export runs async export jobs to PNG folders, print PDFs and TTS sprite sheets
// (port of server/src/routes/export.ts, pdfComposer.ts and ttsExporter.ts).
package export

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"cardstock/internal/config"
	"cardstock/internal/imaging"
	"cardstock/internal/render"
	"cardstock/internal/sheets"
	"cardstock/internal/store"
	"cardstock/internal/tmpl"
)

type Options struct {
	Format          string `json:"format"`
	SelectedCards   []int  `json:"selectedCards"`
	TTSColumns      int    `json:"ttsColumns,omitempty"`
	PDFPageSize     string `json:"pdfPageSize,omitempty"`
	PDFCropMarks    *bool  `json:"pdfCropMarks,omitempty"`
	IncludeCardBack bool   `json:"includeCardBack,omitempty"`
	CardBackImage   string `json:"cardBackImage,omitempty"`
}

type Job struct {
	ID           string   `json:"id"`
	Status       string   `json:"status"`
	Progress     int      `json:"progress"`
	Total        int      `json:"total"`
	Completed    int      `json:"completed"`
	Format       string   `json:"format"`
	OutputPath   string   `json:"outputPath,omitempty"`
	CardBackPath string   `json:"cardBackPath,omitempty"`
	OutputPaths  []string `json:"outputPaths,omitempty"`
	Error        string   `json:"error,omitempty"`
}

var (
	mu   sync.Mutex
	jobs = map[string]*Job{}
)

func GetJob(id string) (Job, bool) {
	mu.Lock()
	defer mu.Unlock()
	j, ok := jobs[id]
	if !ok {
		return Job{}, false
	}
	c := *j
	c.OutputPaths = append([]string(nil), j.OutputPaths...)
	return c, true
}

func update(j *Job, fn func(*Job)) { mu.Lock(); fn(j); mu.Unlock() }

func newJob(format string, total int) *Job {
	j := &Job{ID: store.NewUUID(), Status: "queued", Total: total, Format: format}
	mu.Lock()
	jobs[j.ID] = j
	mu.Unlock()
	return j
}

func run(j *Job, fn func() error) {
	go func() {
		if err := fn(); err != nil {
			update(j, func(j *Job) { j.Status = "error"; j.Error = err.Error() })
		}
	}()
}

func cardbackDir(gameID string) string {
	slug, _ := store.GameSlug(gameID)
	if slug == "" {
		slug = "_none"
	}
	return filepath.Join(config.GamesDir(), slug, "artwork", "cardback")
}

func renderCardBack(gameID, image string, d config.Dims) ([]byte, error) {
	return imaging.CoverResize(filepath.Join(cardbackDir(gameID), image), d.WidthPx, d.HeightPx, config.TargetDPI)
}

func renderCards(templateID string, cards []map[string]string, mapping map[string]string, gameID string, d config.Dims, onDone func()) ([][]byte, error) {
	slug, _ := store.GameSlug(gameID)
	base := tmpl.ArtworkURL(slug)
	pngs := make([][]byte, 0, len(cards))
	for _, card := range cards {
		html, err := tmpl.BuildCardPage(templateID, card, mapping, base, d.WidthCSS, d.HeightCSS)
		if err != nil {
			return nil, err
		}
		png, err := render.CardToPNG(html, d.WidthCSS, d.HeightCSS)
		if err != nil {
			return nil, err
		}
		pngs = append(pngs, png)
		onDone()
	}
	return pngs, nil
}

func pdfOpts(o Options, d config.Dims) pdfOptions {
	size := o.PDFPageSize
	if size == "" {
		size = "letter"
	}
	return pdfOptions{PageSize: size, CropMarks: o.PDFCropMarks == nil || *o.PDFCropMarks, CardWidthInches: d.WidthInches, CardHeightInches: d.HeightInches}
}

func spriteSheet(pngs [][]byte, columns int, d config.Dims) ([]byte, error) {
	count := len(pngs)
	if count == 0 {
		return nil, fmt.Errorf("no cards to export")
	}
	cols := columns
	if cols == 0 {
		cols = min(count, config.TTSMaxColumns)
	}
	cols = min(cols, config.TTSMaxColumns)
	rows := min((count+cols-1)/cols, config.TTSMaxRows)
	return imaging.SpriteSheet(pngs, cols, rows, d.WidthPx, d.HeightPx)
}

func writeFiles(dir string, pngs [][]byte) error {
	for i, p := range pngs {
		if err := os.WriteFile(filepath.Join(dir, fmt.Sprintf("card-%d.png", i+1)), p, 0o644); err != nil {
			return err
		}
	}
	return nil
}

// StartDeck starts a single-deck export and returns the job id.
func StartDeck(templateID string, cards []map[string]string, mapping map[string]string, o Options, gameID string, d config.Dims) string {
	selected := cards
	if len(o.SelectedCards) > 0 {
		selected = make([]map[string]string, 0, len(o.SelectedCards))
		for _, i := range o.SelectedCards {
			if i >= 0 && i < len(cards) {
				selected = append(selected, cards[i])
			}
		}
	}
	j := newJob(o.Format, len(selected))
	run(j, func() error {
		update(j, func(j *Job) { j.Status = "processing" })
		out := config.OutputDir()
		if err := os.MkdirAll(out, 0o755); err != nil {
			return err
		}
		scale := 80
		if o.Format == "png" {
			scale = 90
		}
		n := 0
		pngs, err := renderCards(templateID, selected, mapping, gameID, d, func() {
			n++
			update(j, func(j *Job) { j.Completed = n; j.Progress = int(float64(n)/float64(len(selected))*float64(scale) + 0.5) })
		})
		if err != nil {
			return err
		}
		var back []byte
		if o.IncludeCardBack && o.CardBackImage != "" {
			if back, err = renderCardBack(gameID, o.CardBackImage, d); err != nil {
				return err
			}
		}
		ts := time.Now().UnixMilli()
		switch o.Format {
		case "png":
			dir := filepath.Join(out, fmt.Sprintf("cards-%d", ts))
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return err
			}
			if err := writeFiles(dir, pngs); err != nil {
				return err
			}
			if back != nil {
				p := filepath.Join(dir, "card-back.png")
				if err := os.WriteFile(p, back, 0o644); err != nil {
					return err
				}
				update(j, func(j *Job) { j.CardBackPath = p })
			}
			update(j, func(j *Job) { j.OutputPath = dir })
		case "pdf":
			all := pngs
			if back != nil {
				all = append(all, back)
			}
			b, err := composePDF(all, pdfOpts(o, d))
			if err != nil {
				return err
			}
			name := fmt.Sprintf("cards-%d.pdf", ts)
			if err := os.WriteFile(filepath.Join(out, name), b, 0o644); err != nil {
				return err
			}
			update(j, func(j *Job) { j.OutputPath = "/output/" + name })
		case "tts":
			sheet, err := spriteSheet(pngs, o.TTSColumns, d)
			if err != nil {
				return err
			}
			name := fmt.Sprintf("tts-sheet-%d.png", ts)
			if err := os.WriteFile(filepath.Join(out, name), sheet, 0o644); err != nil {
				return err
			}
			update(j, func(j *Job) { j.OutputPath = "/output/" + name })
			if back != nil {
				bn := fmt.Sprintf("tts-back-%d.png", ts)
				if err := os.WriteFile(filepath.Join(out, bn), back, 0o644); err != nil {
					return err
				}
				update(j, func(j *Job) { j.CardBackPath = "/output/" + bn })
			}
		}
		update(j, func(j *Job) { j.Progress = 100; j.Status = "complete" })
		return nil
	})
	return j.ID
}

var unsafeName = regexp.MustCompile(`[^a-zA-Z0-9-_ ]`)

func safeName(s string) string { return strings.TrimSpace(unsafeName.ReplaceAllString(s, "")) }

// DeckDims resolves a stored deck's card size.
func DeckDims(d store.Deck) config.Dims {
	return config.ResolveDeckDims(d.CardSizePreset, d.CardWidthInches, d.CardHeightInches, d.Landscape)
}

// StartGame exports every deck in a game into its own subfolder.
func StartGame(game store.Game, decks []store.Deck, o Options) string {
	j := newJob(o.Format, 0)
	j.OutputPaths = []string{}
	run(j, func() error {
		update(j, func(j *Job) { j.Status = "processing" })
		ts := time.Now().UnixMilli()
		gameDir := filepath.Join(config.OutputDir(), fmt.Sprintf("%s-%d", safeName(game.Title), ts))
		if err := os.MkdirAll(gameDir, 0o755); err != nil {
			return err
		}
		type deckCards struct {
			deck  store.Deck
			cards []map[string]string
		}
		var all []deckCards
		for _, deck := range decks {
			url, err := sheets.BuildTabCSVURL(game.SheetURL, deck.SheetTabGid)
			if err != nil {
				return err
			}
			data, err := sheets.FetchData(url)
			if err != nil {
				return err
			}
			all = append(all, deckCards{deck, data.Rows})
			update(j, func(j *Job) { j.Total += len(data.Rows) })
		}
		done := 0
		for _, dc := range all {
			name := safeName(dc.deck.Name)
			deckDir := filepath.Join(gameDir, name)
			if err := os.MkdirAll(deckDir, 0o755); err != nil {
				return err
			}
			d := DeckDims(dc.deck)
			pngs, err := renderCards(dc.deck.TemplateID, dc.cards, dc.deck.Mapping, game.ID, d, func() {
				done++
				update(j, func(j *Job) { j.Completed = done; j.Progress = int(float64(done)/float64(j.Total)*80 + 0.5) })
			})
			if err != nil {
				return err
			}
			var back []byte
			if dc.deck.CardBackImage != "" {
				if back, err = renderCardBack(game.ID, dc.deck.CardBackImage, d); err != nil {
					return err
				}
			}
			var produced string
			switch o.Format {
			case "png":
				if err := writeFiles(deckDir, pngs); err != nil {
					return err
				}
				if back != nil {
					if err := os.WriteFile(filepath.Join(deckDir, "card-back.png"), back, 0o644); err != nil {
						return err
					}
				}
				produced = deckDir
			case "pdf":
				all := pngs
				if back != nil {
					all = append(all, back)
				}
				b, err := composePDF(all, pdfOpts(o, d))
				if err != nil {
					return err
				}
				produced = filepath.Join(deckDir, name+".pdf")
				if err := os.WriteFile(produced, b, 0o644); err != nil {
					return err
				}
			case "tts":
				sheet, err := spriteSheet(pngs, o.TTSColumns, d)
				if err != nil {
					return err
				}
				if err := os.WriteFile(filepath.Join(deckDir, name+"-tts.png"), sheet, 0o644); err != nil {
					return err
				}
				if back != nil {
					if err := os.WriteFile(filepath.Join(deckDir, name+"-back.png"), back, 0o644); err != nil {
						return err
					}
				}
				produced = deckDir
			}
			update(j, func(j *Job) { j.OutputPaths = append(j.OutputPaths, produced) })
		}
		update(j, func(j *Job) { j.OutputPath = gameDir; j.Progress = 100; j.Status = "complete" })
		return nil
	})
	return j.ID
}
