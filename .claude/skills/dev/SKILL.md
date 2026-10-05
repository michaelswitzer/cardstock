---
name: dev
description: Run Cardstock for development (Go server + Vite dev server with HMR)
disable-model-invocation: true
argument-hint: "[start|stop|restart]"
---

Manage the Cardstock dev setup. The argument determines the action:
- `start` (default): stop stale processes, then start the Go server and Vite
- `stop`: stop both
- `restart`: stop then start

## Stop Procedure

Find and kill processes listening on ports 3001 and 5173/5174:
- macOS/Linux: `lsof -ti tcp:3001 -ti tcp:5173 -ti tcp:5174 | xargs kill`
- Windows (Git Bash): `netstat -ano | findstr "LISTENING" | findstr ":3001 :5173 :5174"` then `taskkill //PID <pid> //F`

## Start Procedure

1. Run the stop procedure.
2. Start the Go server as a background process, with a dev data folder and no UI window:
   ```bash
   cd app && go run . --data ../devdata --port 3001 --ui=none --no-exit
   ```
   Wait for "server running on http://127.0.0.1:3001".
3. Start Vite as a background process:
   ```bash
   cd client && npx vite
   ```
4. Open http://localhost:5173 (Vite proxies `/api`, `/output`, `/games` to port 3001).

## Notes
- Client changes hot-reload via Vite. Go changes need a server restart (see the restart-server skill).
- Template HTML/CSS is read from disk on every render; no restart needed.
- Rendering needs a Chromium-based browser (Chrome/Edge/Chromium/Brave). Pass `--chrome /path` to pick one.
