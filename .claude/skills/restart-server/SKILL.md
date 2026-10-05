---
name: restart-server
description: Restart the Go server after code changes. Use this automatically after modifying any Go source under app/.
allowed-tools: Bash
---

Restart the Cardstock Go server. This is needed after any change to Go code in `app/`.

Template HTML/CSS changes do NOT require a restart — they are read from disk on every render.
Client changes do NOT require a restart — Vite HMR handles them in dev mode.

## Steps

1. Kill the process listening on port 3001:
   - macOS/Linux: `lsof -ti tcp:3001 | xargs kill`
   - Windows (Git Bash): `netstat -ano | findstr "LISTENING" | findstr ":3001"` then `taskkill //PID <pid> //F`
2. Start it again as a background process:
   ```bash
   cd app && go run . --data ../devdata --port 3001 --ui=none --no-exit
   ```
3. Confirm it prints "server running on http://127.0.0.1:3001". If Vite isn't running, start it with `cd client && npx vite`.
