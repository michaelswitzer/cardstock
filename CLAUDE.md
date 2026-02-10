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

Verify the server is working by confirming it prints "CardMaker server running on http://localhost:3001". If it doesn't appear, check for stale processes.

**Stale processes:** Previous dev sessions frequently leave orphaned node/vite processes holding ports 3001, 5173, or 5174. Before starting, check and kill them:
```bash
netstat -ano | findstr "LISTENING" | findstr ":3001 :5173 :5174"
taskkill //PID <pid> //F    # Use //PID not /PID in Git Bash on Windows
```

**Server auto-reloads** when run via `tsx watch` (the `npm run dev -w server` script), but when started directly with `npx tsx src/index.ts` it does not. After changing server code, restart the server process manually.

**Auto-restart rule:** Whenever you make changes to server code or templates, automatically restart the server (kill the old process, start a new one) without waiting for the user to ask. Template HTML/CSS is cached in memory, so template changes also require a restart.

## Architecture

Monorepo with three npm workspaces: `shared/`, `server/`, `client/`.

### Shared (`shared/src/`)
Types and constants consumed by both server and client. Exports from `types.ts` (all interfaces) and `constants.ts` (dimensions, DPI, ports). Must be built before server/client can use new types.

### Server (`server/src/`)
Express API on port 3001. Routes follow a pattern: each file in `routes/` exports a Router, registered in `index.ts`. Services are pure async functions (no classes).

**Rendering pipeline:** Template HTML/CSS loaded from `server/templates/<id>/` → placeholders hydrated (`{{field}}` for text, `{{image:slot}}` for artwork URLs) → Puppeteer screenshots the page → sharp adds DPI metadata for export.

**Key rendering constants:** 100 CSS px = 1 inch. Cards are 250×350 CSS px. Puppeteer renders at `deviceScaleFactor: 3` producing 750×1050 px output at 300 DPI.

**Export is async:** `POST /api/export` returns a job ID immediately. The job runs in the background, client polls `GET /api/export/:jobId` for progress. Jobs are stored in an in-memory Map. Output goes to `output/` directory.

**Templates** are filesystem-based in `server/templates/<id>/` with three files: `manifest.json` (fields, image slots, dimensions), `template.html` (with `{{placeholder}}` syntax), `template.css`.

### Client (`client/src/`)
React 19 + Vite. Vite proxies `/api`, `/artwork`, `/output` to `localhost:3001`.

**4-step wizard flow:** DataSourcePage → TemplateEditorPage → CardPreviewPage → ExportPage. Navigation via React Router, step bar in WizardLayout.

**State:** Zustand store (`stores/appStore.ts`) holds all wizard state as flat fields with action methods. React Query handles server data fetching and caching. API functions in `api/client.ts` mirror server routes.

**Defaults:** User settings (sheet URL, template, field mappings) persist to `.cardmaker-defaults.json` at project root via `/api/defaults`. Pages auto-populate from defaults on load but don't auto-fetch.

### Data Flow
1. User provides Google Sheets URL → server fetches published CSV, parses with PapaParse → returns headers + rows
2. User selects template, maps template fields to sheet columns
3. Server hydrates template HTML with mapped data, Puppeteer renders screenshots
4. Export: renders all cards to PNG buffers, then composes into format (individual PNGs, PDF with optional crop marks via pdf-lib, or TTS sprite sheet via sharp)

## Conventions

- Artwork images go in `artwork/` at project root, served statically at `/artwork`
- Export output goes to `output/` at project root, served at `/output`
- Both `artwork/` content and `output/` are gitignored
- Server routes use `next(err)` pattern for error handling with centralized `errorHandler` middleware
- `PROJECT_ROOT` is resolved relative to `__dirname` in server files (ESM with `fileURLToPath`)
