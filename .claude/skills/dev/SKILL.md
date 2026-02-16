---
name: dev
description: Build and launch CardMaker as an Electron desktop app
disable-model-invocation: true
argument-hint: "[start|stop|restart]"
---

Manage the CardMaker Electron app. The argument determines the action:
- `start` (default if no argument): stop stale processes, build, and launch Electron
- `stop`: stop all CardMaker processes
- `restart`: stop then start

## Stop Procedure

1. Find processes on ports 3001, 5173, and 5174:
   ```bash
   netstat -ano | findstr "LISTENING" | findstr ":3001 :5173 :5174"
   ```
2. Kill each found PID:
   ```bash
   taskkill //PID <pid> //F
   ```
   Use `//PID` not `/PID` (Git Bash on Windows).

## Start Procedure

1. First run the stop procedure to clear stale processes.

2. Build everything:
   ```bash
   cd /c/Users/mikes/Documents/CardMaker && npm run build:electron
   ```

3. Launch Electron in dev mode as a background process:
   ```bash
   cd /c/Users/mikes/Documents/CardMaker && npx electron .
   ```

Report the status when done.

## Important Notes
- Always use Electron mode. Never start separate server/client dev processes.
- Electron runs the Express server in-process (no separate node server needed).
- No Vite dev server is needed — Electron serves the built client as static files.
