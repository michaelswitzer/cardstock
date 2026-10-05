// Package api wires the HTTP routes (port of server/src/index.ts and routes/*.ts).
// Paths, status codes and JSON shapes match the old Express server so the client is unchanged.
package api

import (
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"cardstock/internal/config"
	"cardstock/internal/render"
)

// Hooks connect desktop-shell behaviour (implemented in main/launcher) to the API.
type Hooks struct {
	Heartbeat         func()
	Bye               func()
	SwitchDataFolder  func(path string) error
	DefaultDataFolder func() string
	PickFolder        func() (string, error)
	OpenPath          func(path string) error
}

var hooks Hooks

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// serverErr mirrors middleware/errorHandler.ts.
func serverErr(w http.ResponseWriter, err error) {
	log.Println("Server error:", err)
	writeErr(w, 500, err.Error())
}

func decode(r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, 10<<20)
	return json.NewDecoder(r.Body).Decode(v)
}

// serveDir serves files under dir() without directory listings or path escapes.
func serveDir(prefix string, dir func() string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rel := strings.TrimPrefix(r.URL.Path, prefix)
		full, ok := within(dir(), rel)
		if !ok {
			http.NotFound(w, r)
			return
		}
		if st, err := os.Stat(full); err != nil || st.IsDir() {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, full)
	}
}

// within joins rel onto base and reports whether the result stays inside base.
func within(base, rel string) (string, bool) {
	full := filepath.Join(base, filepath.FromSlash(rel))
	r, err := filepath.Rel(base, full)
	if err != nil || r == ".." || strings.HasPrefix(r, ".."+string(filepath.Separator)) {
		return "", false
	}
	return full, true
}

// spa serves the embedded client build, falling back to index.html for client routes.
func spa(client fs.FS) http.HandlerFunc {
	files := http.FileServer(http.FS(client))
	return func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p != "" {
			if st, err := fs.Stat(client, p); err == nil && !st.IsDir() {
				files.ServeHTTP(w, r)
				return
			}
		}
		index, err := fs.ReadFile(client, "index.html")
		if err != nil {
			http.Error(w, "Client not built. Run `npm run build` before `go build`, or use the Vite dev server on :5173.", 404)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(index)
	}
}

// New builds the HTTP handler.
func New(client fs.FS, h Hooks) http.Handler {
	hooks = h
	mux := http.NewServeMux()

	mux.Handle("GET /games/", serveDir("/games/", config.GamesDir))
	mux.Handle("GET /templates/", serveDir("/templates/", config.TemplatesDir))
	mux.Handle("GET /output/", serveDir("/output/", config.OutputDir))
	mux.HandleFunc("GET /__render/{id}", render.ServePending)

	registerSheets(mux)
	registerCards(mux)
	registerExport(mux)
	registerTemplates(mux)
	registerGames(mux)
	registerImages(mux)
	registerDecks(mux)
	registerApp(mux)

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { writeErr(w, 404, "Not found") })
	mux.Handle("/", spa(client))
	return mux
}
