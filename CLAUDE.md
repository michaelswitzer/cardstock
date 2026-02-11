# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build            # Build all workspaces (shared → server → client)
npm run build -w shared  # Build shared package (must run first if types changed)
```

No test framework is currently configured.

## Running Dev Servers

**Start server and client as separate background processes** rather than using `npm run dev` (which uses concurrently). The `tsx watch` server often fails to start silently under concurrently.

```bash
cd server && npx tsx src/index.ts    # Server on port 3001
cd client && npx vite                # Client on port 5173
```

Verify the server is working by confirming it prints "Cardstock server running on http://localhost:3001". If it doesn't appear, check for stale processes.

**Stale processes:** Previous dev sessions frequently leave orphaned node/vite processes holding ports 3001, 5173, or 5174. Before starting, check and kill them:
```bash
netstat -ano | findstr "LISTENING" | findstr ":3001 :5173 :5174"
taskkill //PID <pid> //F    # Use //PID not /PID in Git Bash on Windows
```

**Server auto-reloads** when run via `tsx watch` (the `npm run dev -w server` script), but when started directly with `npx tsx src/index.ts` it does not. After changing server code, restart the server process manually.

**Auto-restart rule:** Whenever you make changes to server code, automatically restart the server (kill the old process, start a new one) without waiting for the user to ask. Template HTML/CSS is read from disk on every render (no caching), so template changes take effect immediately without a server restart.

## Architecture

Monorepo with three npm workspaces: `shared/`, `server/`, `client/`.

### Shared (`shared/src/`)
Types and constants consumed by both server and client. Exports from `types.ts` (all interfaces) and `constants.ts` (dimensions, DPI, ports). Must be built before server/client can use new types.

### Server (`server/src/`)
Express API on port 3001. Routes follow a pattern: each file in `routes/` exports a Router, registered in `index.ts`. Services are pure async functions (no classes).

**Data persistence:** Each game has its own folder under `games/<slug>/` containing a `game.json` file with the game record and embedded decks array. CRUD operations via `services/dataStore.ts`. In-memory indexes (`gameIndex`, `deckIndex`) built on startup for fast lookups. On startup, legacy `.cardmaker-defaults.json` or `.cardmaker-data.json` files are auto-migrated to per-game folders.

**Rendering pipeline:** Template HTML/CSS loaded from `server/templates/<id>/` → placeholders hydrated (`{{field}}` for text, `{{image:slot}}` for artwork URLs, `{icon:name}` for icons) → Puppeteer screenshots the page → sharp adds DPI metadata for export.

**Key rendering constants:** 100 CSS px = 1 inch. Cards are 250×350 CSS px. Puppeteer renders at `deviceScaleFactor: 3` producing 750×1050 px output at 300 DPI.

**Sheet tab discovery:** `services/googleSheets.ts` has `discoverTabs(url)` which fetches the pubhtml page and parses embedded JS for tab names and gids.

**Export is async:** `POST /api/export` returns a job ID immediately. The job runs in the background, client polls `GET /api/export/:jobId` for progress. `POST /api/export/game` exports all decks in a game to subfolders. Card backs are exported as separate files. Output goes to `output/` directory.

**Templates** are filesystem-based in `server/templates/<id>/` with three files: `manifest.json` (fields, image slots, dimensions), `template.html` (with `{{placeholder}}` syntax), `template.css`.

**API Routes:**
- `/api/games` — CRUD for games (projects tied to a Google Sheet)
- `/api/games/:gameId/decks` — list/create decks under a game
- `/api/decks/:id` — get/update/delete individual decks
- `/api/sheets/fetch` — fetch CSV data from a sheet tab
- `/api/sheets/tabs` — discover tabs in a published Google Sheet
- `/api/templates` — list/get templates
- `/api/cards/preview`, `/api/cards/preview-batch` — render card previews
- `/api/export` — single deck export, `/api/export/game` — full game export
- `/api/games/:gameId/images` — list artwork images, covers, cardbacks, thumbnails

### Client (`client/src/`)
React 19 + Vite. Vite proxies `/api` and `/output` to `localhost:3001`.

**Layout:** Sidebar + main content area. React Router handles navigation:
- `/` — GamesInventory (tile grid of games)
- `/games/:id` — GameView (game header, deck list, export all)
- `/games/:id/decks/:deckId` — DeckView (card preview grid, refresh, export)
- `/templates` — TemplateList (view template source)

**State:** Zustand store (`stores/appStore.ts`) holds active game/deck IDs and a deck data cache (headers, rows, card images per deck). Server is the source of truth for games/decks (via React Query). API functions in `api/client.ts` mirror server routes.

**Key concepts:**
- **Game** — a project tied to a Google Sheets document (one URL, multiple tabs)
- **Deck** — pairs a sheet tab + template + field mapping; belongs to a game

### Data Flow
1. User creates a Game with a Google Sheets URL → server discovers tabs via pubhtml parsing
2. User creates Decks: selects a tab, template, and maps fields
3. DeckView fetches tab data as CSV, renders card previews via Puppeteer
4. Export: renders all cards to PNG buffers, composes into format (individual PNGs, PDF with crop marks, or TTS sprite sheet). Card backs exported as separate files.

## Per-Game Folder Layout

Each game gets its own folder under `games/<slug>/`:

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

The `games/` directory is served statically at `/games` (used internally by Puppeteer for rendering). The client accesses images only through the API (`/api/games/:gameId/images/...`).

## Conventions

- Export output goes to `output/` at project root, served at `/output`
- `games/` and `output/` are gitignored
- Server routes use `next(err)` pattern for error handling with centralized `errorHandler` middleware
- `PROJECT_ROOT` is resolved relative to `__dirname` in server files (ESM with `fileURLToPath`)
