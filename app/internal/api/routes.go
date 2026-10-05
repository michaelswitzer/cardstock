package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"cardstock/internal/config"
	"cardstock/internal/export"
	"cardstock/internal/imaging"
	"cardstock/internal/render"
	"cardstock/internal/sheets"
	"cardstock/internal/store"
	"cardstock/internal/tmpl"
)

// --- Sheets ---

func registerSheets(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sheets/fetch", func(w http.ResponseWriter, r *http.Request) {
		url := r.URL.Query().Get("url")
		if url == "" {
			writeErr(w, 400, "Missing required query parameter: url")
			return
		}
		data, err := sheets.FetchData(url)
		if err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, data)
	})
	mux.HandleFunc("GET /api/sheets/tabs", func(w http.ResponseWriter, r *http.Request) {
		url := r.URL.Query().Get("url")
		if url == "" {
			writeErr(w, 400, "Missing required query parameter: url")
			return
		}
		tabs, err := sheets.DiscoverTabs(url)
		if err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, map[string]any{"tabs": tabs})
	})
}

// --- Cards (previews) ---

type dimsInput struct {
	CardSizePreset   string   `json:"cardSizePreset"`
	CardWidthInches  *float64 `json:"cardWidthInches"`
	CardHeightInches *float64 `json:"cardHeightInches"`
	Landscape        *bool    `json:"landscape"`
}

func (d dimsInput) resolve() config.Dims {
	return config.ResolveDeckDims(d.CardSizePreset, d.CardWidthInches, d.CardHeightInches, d.Landscape)
}

func artworkURL(gameID string) string {
	slug, _ := store.GameSlug(gameID)
	return tmpl.ArtworkURL(slug)
}

func registerCards(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/cards/preview", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			dimsInput
			TemplateID string            `json:"templateId"`
			CardData   map[string]string `json:"cardData"`
			Mapping    map[string]string `json:"mapping"`
			GameID     string            `json:"gameId"`
		}
		if err := decode(r, &body); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		if body.TemplateID == "" || body.CardData == nil || body.Mapping == nil {
			writeErr(w, 400, "Missing required fields: templateId, cardData, mapping")
			return
		}
		d := body.resolve()
		html, err := tmpl.BuildCardPage(body.TemplateID, body.CardData, body.Mapping, artworkURL(body.GameID), d.WidthCSS, d.HeightCSS)
		if err != nil {
			serverErr(w, err)
			return
		}
		url, err := render.CardToDataURL(html, d.WidthCSS, d.HeightCSS)
		if err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, map[string]string{"dataUrl": url})
	})

	mux.HandleFunc("POST /api/cards/preview-batch", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			dimsInput
			TemplateID string              `json:"templateId"`
			Cards      []map[string]string `json:"cards"`
			Mapping    map[string]string   `json:"mapping"`
			GameID     string              `json:"gameId"`
		}
		if err := decode(r, &body); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		if body.TemplateID == "" || body.Cards == nil || body.Mapping == nil {
			writeErr(w, 400, "Missing required fields: templateId, cards, mapping")
			return
		}
		d := body.resolve()
		base := artworkURL(body.GameID)
		urls := make([]string, len(body.Cards))
		errs := make([]error, len(body.Cards))
		var wg sync.WaitGroup
		for i, card := range body.Cards {
			wg.Add(1)
			go func() {
				defer wg.Done()
				html, err := tmpl.BuildCardPage(body.TemplateID, card, body.Mapping, base, d.WidthCSS, d.HeightCSS)
				if err == nil {
					urls[i], err = render.CardToDataURL(html, d.WidthCSS, d.HeightCSS)
				}
				errs[i] = err
			}()
		}
		wg.Wait()
		for _, err := range errs {
			if err != nil {
				serverErr(w, err)
				return
			}
		}
		writeJSON(w, 200, map[string]any{"dataUrls": urls})
	})
}

// --- Export ---

func registerExport(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/export", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			dimsInput
			TemplateID string              `json:"templateId"`
			Cards      []map[string]string `json:"cards"`
			Mapping    map[string]string   `json:"mapping"`
			Options    export.Options      `json:"options"`
			GameID     string              `json:"gameId"`
		}
		if err := decode(r, &body); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		id := export.StartDeck(body.TemplateID, body.Cards, body.Mapping, body.Options, body.GameID, body.resolve())
		writeJSON(w, 200, map[string]string{"jobId": id})
	})
	mux.HandleFunc("POST /api/export/game", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			GameID  string         `json:"gameId"`
			Options export.Options `json:"options"`
		}
		if err := decode(r, &body); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		game, ok := store.GetGame(body.GameID)
		if !ok {
			writeErr(w, 404, "Game not found")
			return
		}
		decks := store.ListDecks(body.GameID)
		if len(decks) == 0 {
			writeErr(w, 400, "Game has no decks")
			return
		}
		writeJSON(w, 200, map[string]string{"jobId": export.StartGame(*game, decks, body.Options)})
	})
	mux.HandleFunc("GET /api/export/{jobId}", func(w http.ResponseWriter, r *http.Request) {
		job, ok := export.GetJob(r.PathValue("jobId"))
		if !ok {
			writeErr(w, 404, "Job not found")
			return
		}
		writeJSON(w, 200, job)
	})
}

// --- Templates ---

var templateIDRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func templateResponse(w http.ResponseWriter, status int, id string) {
	t, err := tmpl.Get(id)
	if err != nil {
		serverErr(w, err)
		return
	}
	html, css, err := tmpl.Load(id)
	if err != nil {
		serverErr(w, err)
		return
	}
	writeJSON(w, status, map[string]any{"template": t, "html": html, "css": css})
}

func writeTemplateFiles(dir, manifest, html, css string) error {
	for name, content := range map[string]string{"manifest.json": manifest, "template.html": html, "template.css": css} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
			return err
		}
	}
	return nil
}

// templateDir resolves a template folder, rejecting ids that would escape the templates dir.
func templateDir(id string) (string, bool) {
	if !templateIDRe.MatchString(id) {
		return "", false
	}
	return filepath.Join(config.TemplatesDir(), id), true
}

func registerTemplates(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/templates", func(w http.ResponseWriter, r *http.Request) {
		list, err := tmpl.List()
		if err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, map[string]any{"templates": list})
	})
	mux.HandleFunc("GET /api/templates/{id}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := templateDir(r.PathValue("id")); !ok {
			writeErr(w, 404, "Template not found")
			return
		}
		templateResponse(w, 200, r.PathValue("id"))
	})
	mux.HandleFunc("POST /api/templates", func(w http.ResponseWriter, r *http.Request) {
		var body struct{ ID, Manifest, HTML, CSS string }
		if err := decode(r, &body); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		dir, ok := templateDir(body.ID)
		if !ok {
			writeErr(w, 400, "ID must be a URL-safe slug (letters, numbers, hyphens, underscores)")
			return
		}
		if _, err := os.Stat(dir); err == nil {
			writeErr(w, 409, `Template "`+body.ID+`" already exists`)
			return
		}
		if err := os.MkdirAll(dir, 0o755); err != nil {
			serverErr(w, err)
			return
		}
		if err := writeTemplateFiles(dir, body.Manifest, body.HTML, body.CSS); err != nil {
			serverErr(w, err)
			return
		}
		templateResponse(w, 201, body.ID)
	})
	mux.HandleFunc("PUT /api/templates/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct{ Manifest, HTML, CSS string }
		if err := decode(r, &body); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		dir, ok := templateDir(id)
		if _, err := os.Stat(dir); !ok || err != nil {
			writeErr(w, 404, `Template "`+id+`" not found`)
			return
		}
		if err := writeTemplateFiles(dir, body.Manifest, body.HTML, body.CSS); err != nil {
			serverErr(w, err)
			return
		}
		templateResponse(w, 200, id)
	})
	mux.HandleFunc("POST /api/templates/open-folder", func(w http.ResponseWriter, r *http.Request) {
		if err := hooks.OpenPath(config.TemplatesDir()); err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
	mux.HandleFunc("DELETE /api/templates/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		dir, ok := templateDir(id)
		if _, err := os.Stat(dir); !ok || err != nil {
			writeErr(w, 404, `Template "`+id+`" not found`)
			return
		}
		if err := os.RemoveAll(dir); err != nil {
			serverErr(w, err)
			return
		}
		w.WriteHeader(204)
	})
}

// --- Games ---

// optString reads a JSON string field; null clears it (""), absent returns nil.
func optString(body map[string]json.RawMessage, key string) *string {
	raw, ok := body[key]
	if !ok {
		return nil
	}
	var s *string
	if json.Unmarshal(raw, &s) != nil || s == nil {
		empty := ""
		return &empty
	}
	return s
}

func registerGames(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/games", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{"games": store.ListGames()})
	})
	mux.HandleFunc("POST /api/games", func(w http.ResponseWriter, r *http.Request) {
		var body struct{ Title, Description, SheetURL string }
		if err := decode(r, &body); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		if body.Title == "" || body.SheetURL == "" {
			writeErr(w, 400, "title and sheetUrl are required")
			return
		}
		g, err := store.CreateGame(body.Title, body.Description, body.SheetURL)
		if err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 201, g)
	})
	mux.HandleFunc("GET /api/games/{id}", func(w http.ResponseWriter, r *http.Request) {
		g, ok := store.GetGame(r.PathValue("id"))
		if !ok {
			writeErr(w, 404, "Game not found")
			return
		}
		writeJSON(w, 200, map[string]any{"game": g, "decks": store.ListDecks(g.ID)})
	})
	mux.HandleFunc("PUT /api/games/{id}", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]json.RawMessage
		if err := decode(r, &body); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		u := store.GameUpdate{
			Title:       optString(body, "title"),
			Description: optString(body, "description"),
			CoverImage:  optString(body, "coverImage"),
			SheetURL:    optString(body, "sheetUrl"),
		}
		// title/sheetUrl: null is "not provided" in the old server; only strings update them.
		if u.Title != nil && *u.Title == "" && string(body["title"]) == "null" {
			u.Title = nil
		}
		if u.SheetURL != nil && *u.SheetURL == "" && string(body["sheetUrl"]) == "null" {
			u.SheetURL = nil
		}
		g, err := store.UpdateGame(r.PathValue("id"), u)
		if err != nil {
			serverErr(w, err)
			return
		}
		if g == nil {
			writeErr(w, 404, "Game not found")
			return
		}
		writeJSON(w, 200, g)
	})
	mux.HandleFunc("DELETE /api/games/{id}", func(w http.ResponseWriter, r *http.Request) {
		ok, err := store.DeleteGame(r.PathValue("id"))
		if err != nil {
			serverErr(w, err)
			return
		}
		if !ok {
			writeErr(w, 404, "Game not found")
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
	mux.HandleFunc("POST /api/games/{id}/open-folder", func(w http.ResponseWriter, r *http.Request) {
		dir := store.GameDir(r.PathValue("id"))
		if dir == "" {
			writeErr(w, 404, "Game not found")
			return
		}
		if err := hooks.OpenPath(dir); err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
}

// --- Images ---

var imageRe = regexp.MustCompile(`(?i)\.(png|jpe?g|gif|svg|webp)$`)

var (
	thumbMu    sync.Mutex
	thumbCache = map[string][]byte{}
)

func listImages(dir string) ([]string, error) {
	images := []string{}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		if !e.IsDir() && imageRe.MatchString(e.Name()) {
			images = append(images, e.Name())
		}
	}
	return images, nil
}

func registerImages(mux *http.ServeMux) {
	gameDir := func(w http.ResponseWriter, r *http.Request) string {
		dir := store.GameDir(r.PathValue("gameId"))
		if dir == "" {
			writeErr(w, 404, "Game not found")
		}
		return dir
	}

	mux.HandleFunc("GET /api/games/{gameId}/images", func(w http.ResponseWriter, r *http.Request) {
		dir := gameDir(w, r)
		if dir == "" {
			return
		}
		artwork := filepath.Join(dir, "artwork")
		if err := os.MkdirAll(artwork, 0o755); err != nil {
			serverErr(w, err)
			return
		}
		images := []string{}
		err := filepath.WalkDir(artwork, func(p string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if !d.IsDir() && imageRe.MatchString(d.Name()) {
				rel, _ := filepath.Rel(artwork, p)
				images = append(images, filepath.ToSlash(rel))
			}
			return nil
		})
		if err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, map[string]any{"images": images})
	})
	mux.HandleFunc("GET /api/games/{gameId}/images/covers", func(w http.ResponseWriter, r *http.Request) {
		dir := gameDir(w, r)
		if dir == "" {
			return
		}
		images, err := listImages(dir)
		if err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, map[string]any{"images": images})
	})
	mux.HandleFunc("GET /api/games/{gameId}/images/cardbacks", func(w http.ResponseWriter, r *http.Request) {
		dir := gameDir(w, r)
		if dir == "" {
			return
		}
		cb := filepath.Join(dir, "artwork", "cardback")
		if err := os.MkdirAll(cb, 0o755); err != nil {
			serverErr(w, err)
			return
		}
		images, err := listImages(cb)
		if err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, map[string]any{"images": images})
	})
	mux.HandleFunc("GET /api/games/{gameId}/images/thumb/{path...}", func(w http.ResponseWriter, r *http.Request) {
		dir := gameDir(w, r)
		if dir == "" {
			return
		}
		rel := r.PathValue("path")
		full, ok := within(dir, rel)
		if !ok {
			writeErr(w, 400, "Invalid path")
			return
		}
		if strings.EqualFold(filepath.Ext(full), ".svg") {
			w.Header().Set("Cache-Control", "public, max-age=86400")
			http.ServeFile(w, r, full)
			return
		}
		num := func(key string, def, max int) int {
			n, _ := strconv.Atoi(r.URL.Query().Get(key))
			if n <= 0 {
				n = def
			}
			return min(n, max)
		}
		tw, th := num("w", 150, 400), num("h", 210, 560)
		key := r.PathValue("gameId") + ":" + rel + ":" + strconv.Itoa(tw) + "x" + strconv.Itoa(th)
		thumbMu.Lock()
		buf, ok := thumbCache[key]
		thumbMu.Unlock()
		if !ok {
			var err error
			if buf, err = imaging.Thumbnail(full, tw, th); err != nil {
				serverErr(w, err)
				return
			}
			thumbMu.Lock()
			if len(thumbCache) > 1000 {
				thumbCache = map[string][]byte{}
			}
			thumbCache[key] = buf
			thumbMu.Unlock()
		}
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		w.Write(buf)
	})
	mux.HandleFunc("POST /api/games/{gameId}/images/upload-cover", func(w http.ResponseWriter, r *http.Request) {
		dir := gameDir(w, r)
		if dir == "" {
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 10<<20+1<<16)
		file, header, err := r.FormFile("cover")
		if err != nil {
			writeErr(w, 400, "No file uploaded")
			return
		}
		defer file.Close()
		if !imageRe.MatchString(header.Filename) {
			serverErr(w, errors.New("Only image files (png, jpg, gif, svg, webp) are allowed"))
			return
		}
		if header.Size > 10<<20 {
			serverErr(w, errors.New("File too large"))
			return
		}
		name := regexp.MustCompile(`[^a-zA-Z0-9._-]`).ReplaceAllString(header.Filename, "_")
		data, err := io.ReadAll(file)
		if err != nil {
			serverErr(w, err)
			return
		}
		if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
			serverErr(w, err)
			return
		}
		g, err := store.UpdateGame(r.PathValue("gameId"), store.GameUpdate{CoverImage: &name})
		if err != nil {
			serverErr(w, err)
			return
		}
		if g == nil {
			writeErr(w, 404, "Game not found")
			return
		}
		writeJSON(w, 200, g)
	})
}

// --- Decks ---

func registerDecks(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/games/{gameId}/decks", func(w http.ResponseWriter, r *http.Request) {
		g, ok := store.GetGame(r.PathValue("gameId"))
		if !ok {
			writeErr(w, 404, "Game not found")
			return
		}
		writeJSON(w, 200, map[string]any{"decks": store.ListDecks(g.ID)})
	})
	mux.HandleFunc("POST /api/games/{gameId}/decks", func(w http.ResponseWriter, r *http.Request) {
		var sd store.StoredDeck
		if err := decode(r, &sd); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		if sd.Name == "" || sd.SheetTabGid == "" || sd.SheetTabName == "" || sd.TemplateID == "" {
			writeErr(w, 400, "name, sheetTabGid, sheetTabName, and templateId are required")
			return
		}
		deck, err := store.CreateDeck(r.PathValue("gameId"), sd)
		if err != nil {
			serverErr(w, err)
			return
		}
		if deck == nil {
			writeErr(w, 404, "Game not found")
			return
		}
		writeJSON(w, 201, deck)
	})
	mux.HandleFunc("GET /api/decks/{id}", func(w http.ResponseWriter, r *http.Request) {
		deck, err := store.GetDeck(r.PathValue("id"))
		if err != nil {
			serverErr(w, err)
			return
		}
		if deck == nil {
			writeErr(w, 404, "Deck not found")
			return
		}
		writeJSON(w, 200, deck)
	})
	mux.HandleFunc("PUT /api/decks/{id}", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]json.RawMessage
		if err := decode(r, &body); err != nil {
			writeErr(w, 400, err.Error())
			return
		}
		deck, err := store.UpdateDeck(r.PathValue("id"), body)
		if err != nil {
			serverErr(w, err)
			return
		}
		if deck == nil {
			writeErr(w, 404, "Deck not found")
			return
		}
		writeJSON(w, 200, deck)
	})
	mux.HandleFunc("DELETE /api/decks/{id}", func(w http.ResponseWriter, r *http.Request) {
		ok, err := store.DeleteDeck(r.PathValue("id"))
		if err != nil {
			serverErr(w, err)
			return
		}
		if !ok {
			writeErr(w, 404, "Deck not found")
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
}

// --- App shell (replaces Electron IPC) ---

func registerApp(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/app/info", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{
			"dataFolder":        config.Root(),
			"defaultDataFolder": hooks.DefaultDataFolder(),
		})
	})
	mux.HandleFunc("GET /api/app/status", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{"renderer": render.GetStatus()})
	})
	mux.HandleFunc("POST /api/app/open-renderer-folder", func(w http.ResponseWriter, r *http.Request) {
		dir := render.HomeDir()
		if d := render.GetStatus().Downloaded; d != nil {
			dir = filepath.Dir(d.Path)
		}
		if err := hooks.OpenPath(dir); err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
	mux.HandleFunc("POST /api/app/heartbeat", func(w http.ResponseWriter, r *http.Request) {
		hooks.Heartbeat()
		w.WriteHeader(204)
	})
	mux.HandleFunc("POST /api/app/bye", func(w http.ResponseWriter, r *http.Request) {
		hooks.Bye()
		w.WriteHeader(204)
	})
	mux.HandleFunc("POST /api/app/pick-folder", func(w http.ResponseWriter, r *http.Request) {
		path, err := hooks.PickFolder()
		if err != nil {
			writeErr(w, 501, err.Error())
			return
		}
		writeJSON(w, 200, map[string]any{"path": path})
	})
	mux.HandleFunc("POST /api/app/data-folder", func(w http.ResponseWriter, r *http.Request) {
		var body struct{ Path string }
		if err := decode(r, &body); err != nil || strings.TrimSpace(body.Path) == "" {
			writeErr(w, 400, "path is required")
			return
		}
		if err := hooks.SwitchDataFolder(strings.TrimSpace(body.Path)); err != nil {
			serverErr(w, err)
			return
		}
		writeJSON(w, 200, map[string]string{"dataFolder": config.Root()})
	})
}
