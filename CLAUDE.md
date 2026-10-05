# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build      # Build shared types + client, copy client/dist → app/web/dist (embedded by Go)
npm run app        # build + compile app/cardstock(.exe) for this machine
npm run release    # build + cross-compile unzip-and-run archives for every OS into app/dist/
npm test           # Go unit tests (app/internal/...)
```

Go commands go through `node scripts/go.js <args>`, which runs them in `app/` with `CGO_ENABLED=0` (the app is pure Go). The Go module needs Go 1.26+.

## Running Dev Servers

Start the Go server and Vite as separate background processes:

```bash
cd app && go run . --data ../devdata --port 3001 --ui=none --no-exit   # API on 127.0.0.1:3001
cd client && npx vite                                                  # Client on :5173, proxies to 3001
```

Verify the server prints "server running on http://127.0.0.1:3001". `--ui=none --no-exit` stops it from opening a window and from exiting when no UI heartbeat arrives. `--chrome /path/to/chromium` picks the rendering browser.

**Stale processes:** kill whatever holds ports 3001/5173/5174 before starting (`lsof -ti tcp:3001 | xargs kill`; on Windows Git Bash `netstat -ano | findstr "LISTENING" | findstr ":3001"` then `taskkill //PID <pid> //F`).

**Auto-restart rule:** Whenever you change Go code under `app/`, restart the server (kill the old process, start a new one) without waiting for the user to ask. Template HTML/CSS is read from disk on every render (no caching), so template changes take effect immediately without a restart.

## Architecture

Two parts: a Go program (`app/`) that is the whole desktop app, and a React client (`client/`) that the Go binary embeds. `shared/` holds TypeScript types/constants used by the client (npm workspaces: `shared`, `client`).

### App (`app/`)
A single static binary (~10 MB, no installer). On launch it resolves the data folder, starts an HTTP server on 127.0.0.1 (first free port from 3001), opens the UI, and renders cards through a headless Chromium over the DevTools protocol (chromedp v0.14).

- `main.go` — flags, data-folder resolution, single-instance check (`<data>/.cardstock-port`), shutdown
- `embed.go` — embeds `web/dist` (client build) and `templates/` (starter templates seeded into new data folders)
- `internal/config` — constants (mirror `shared/src/constants.ts`) and the mutable data-root paths
- `internal/store` — games/decks persistence (`games/<slug>/game.json`), in-memory indexes, legacy migration
- `internal/sheets` — Google Sheets CSV fetch + pubhtml tab discovery (`ParseTabs`)
- `internal/tmpl` — template loading and placeholder hydration
- `internal/render` — headless browser discovery/download, tab pool, screenshots
- `internal/imaging` — thumbnails, card-back cover resize, TTS sprite sheets, PNG DPI (pHYs) metadata
- `internal/export` — async export jobs: PNG folders, PDF (gopdf) with crop marks, TTS sheets
- `internal/api` — HTTP routes; paths and JSON shapes match `client/src/api/client.ts`
- `internal/launcher` — opens the UI window, native folder picker, open-folder, Windows message box
- `tools/release` — cross-compiles and packages release archives (macOS `.app` bundle, Windows icon via go-winres)

**Data folder:** `--data` flag → folder saved in `<UserConfigDir>/cardstock/config.json` (set by "Change Data Folder" in the UI) → the folder next to the executable (next to `Cardstock.app` on macOS) if writable and not `/Applications` → `~/Documents/Cardstock`. It contains `games/`, `templates/`, `output/` and `cardstock.log`. In portable mode a `renderer/` folder (downloaded browser + profiles) sits next to the executable as well.

**UI window & lifetime:** If a Chromium-family browser is installed, the UI opens as an app-mode window (`--app=URL`, separate `ui-profile` in the renderer folder); otherwise in the default browser (`--ui=auto|app|browser|none`). The client posts `/api/app/heartbeat` every 5 s and a `/api/app/bye` beacon on `pagehide`; the app exits ~12 s after the last window closes (90 s without heartbeats as a fallback, since background tabs are throttled). Launching a second copy on the same data folder just opens another window on the running one.

**Rendering pipeline:** Template HTML/CSS loaded from `<data>/templates/<id>/` → placeholders hydrated (`{{field}}` for text, `{{image:slot}}` for artwork URLs, `{icon:name}` for icons, `{{template:filename}}` for template-local assets) → the page is served at `/__render/<id>` and loaded by a headless tab (so relative `/templates/...` and `/games/...` URLs resolve) → screenshot with a transparent background → pHYs chunk set to 300 DPI for export. Templates can include static image files; reference them in CSS with `url(/templates/<id>/filename)` or in HTML with `{{template:filename}}`.

**Renderer browser:** `--chrome` / `CARDSTOCK_CHROME` → installed Chrome/Edge/Chromium/Brave/Vivaldi → on NixOS, `nix build nixpkgs#chromium` linked to `<renderer>/chromium` (the link is also a GC root) → previously downloaded `chrome-headless-shell` → download one from Chrome for Testing into `<renderer>/chrome-headless-shell/`. `<renderer>` is a `renderer/` folder next to the executable in portable mode (`render.SetHomeDir`), else `<UserCacheDir>/cardstock/`; browser profiles (`render-profile`, `ui-profile`) live there too. `/api/app/status` reports download progress/target and, after a download in this run, `downloaded` so the client can confirm where it went (`components/AppStatus.tsx`). `CARDSTOCK_RENDERER=download` forces the Chrome for Testing download (even on NixOS, where it can't start for lack of system libs). On NixOS the app also unsets `LD_LIBRARY_PATH`, which can break nixpkgs Chromium. Firefox can't render (no CDP) but works fine as the UI browser.

**Key rendering constants:** 100 CSS px = 1 inch. Cards are 250×350 CSS px. Rendered at device scale factor 3 → 750×1050 px at 300 DPI.

**Export is async:** `POST /api/export` returns a job ID immediately; the client polls `GET /api/export/:jobId`. `POST /api/export/game` exports all decks in a game to subfolders. Card backs are exported as separate files. Output goes to `<data>/output/`, served at `/output`.

**Templates** are folders in `<data>/templates/<id>/` with `manifest.json` (fields, image slots), `template.html` (`{{placeholder}}` syntax) and `template.css`. The bundled starter templates live in `app/templates/`.

**API Routes:**
- `/api/games` — CRUD for games (projects tied to a Google Sheet); `/api/games/:id/open-folder`
- `/api/games/:gameId/decks` — list/create decks under a game
- `/api/decks/:id` — get/update/delete individual decks
- `/api/sheets/fetch`, `/api/sheets/tabs` — sheet CSV data and tab discovery
- `/api/templates` — list/get/create/update/delete templates; `/api/templates/open-folder`
- `/api/cards/preview`, `/api/cards/preview-batch` — render card previews (data URLs)
- `/api/export`, `/api/export/game`, `/api/export/:jobId` — exports
- `/api/games/:gameId/images` — artwork list, `covers`, `cardbacks`, `thumb/*`, `upload-cover`
- `/api/app/info|status|heartbeat|bye|pick-folder|data-folder|open-renderer-folder` — desktop-shell functions (replaced Electron IPC)

### Client (`client/src/`)
React 19 + Vite. Vite proxies `/api`, `/output` and `/games` to `localhost:3001`.

**Layout:** Sidebar + main content area. React Router handles navigation:
- `/` — GamesInventory (tile grid of games)
- `/games/:id` — GameView (game header, deck list, export all)
- `/games/:id/decks/:deckId` — DeckView (card preview grid, refresh, export)
- `/templates` — TemplateList (view template source)

**State:** Zustand store (`stores/appStore.ts`) holds active game/deck IDs and a deck data cache (headers, rows, card images per deck). The server is the source of truth for games/decks (via React Query). API functions in `api/client.ts` mirror server routes. `components/AppStatus.tsx` sends the keep-alive heartbeat and shows the renderer download/error banner.

**Key concepts:**
- **Game** — a project tied to a Google Sheets document (one URL, multiple tabs)
- **Deck** — pairs a sheet tab + template + field mapping; belongs to a game

### Data Flow
1. User creates a Game with a Google Sheets URL → server discovers tabs via pubhtml parsing
2. User creates Decks: selects a tab, template, and maps fields
3. DeckView fetches tab data as CSV, renders card previews in the headless browser
4. Export: renders all cards to PNGs, composes into format (individual PNGs, PDF with crop marks, or TTS sprite sheet). Card backs exported as separate files.

## Per-Game Folder Layout

Each game gets its own folder under `<data>/games/<slug>/`:

```
games/
└── my-card-game/           # Slug auto-generated from game title
    ├── game.json            # Game record + embedded decks array
    ├── cover.png            # Cover images at folder root (any image file)
    └── artwork/
        ├── cardart/         # Card art referenced in Google Sheets (e.g. C001.png)
        ├── cardback/        # Card back images for decks
        └── icons/           # Icons used with {icon:name} in templates
```

**Image placement:**
- **Card art** → `games/<slug>/artwork/cardart/` — filename in the sheet's Image column (e.g. `C001.png`)
- **Card backs** → `games/<slug>/artwork/cardback/` — selected per-deck in the deck editor
- **Icons** → `games/<slug>/artwork/icons/` — referenced as `{icon:name}` in template HTML (resolved to `icons/<name>.png`)
- **Cover images** → `games/<slug>/` root — any image file at the game folder root can be set as cover

The `games/` directory is served statically at `/games` (used by the headless renderer). The client accesses images only through the API (`/api/games/:gameId/images/...`).

## Conventions

- Handlers report failures with `serverErr(w, err)` → `500 {"error": message}`, matching the old Express error middleware
- Keep the HTTP/JSON contract in `internal/api` in sync with `client/src/api/client.ts` and `shared/src/types.ts`
- `devdata/`, `app/web/dist/*` and `app/dist/` are gitignored
- Release archives are unsigned: macOS needs right-click → Open the first time; Windows SmartScreen needs "More info → Run anyway"
