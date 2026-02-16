---
name: restart-server
description: Restart the Express server after code changes. Use this automatically after modifying any server source files.
allowed-tools: Bash
---

Restart the CardMaker Express server. This is needed after any change to server source files.

Template HTML/CSS changes do NOT require a restart — they are read from disk on every render.
Client changes do NOT require a restart — Vite HMR handles them automatically in dev mode.

## Steps

1. Find and kill ALL processes on ports 3001, 5173, and 5174 (Express, Vite, Electron):
   ```bash
   netstat -ano | findstr "LISTENING" | findstr ":3001 :5173 :5174"
   taskkill //PID <pid> //F
   ```
   Use `//PID` not `/PID` (Git Bash on Windows).

2. Rebuild the server:
   ```bash
   cd /c/Users/mikes/Documents/CardMaker && npm run build:electron
   ```

3. Start Vite dev server as a background process:
   ```bash
   cd /c/Users/mikes/Documents/CardMaker/client && npx vite
   ```

4. Wait for Vite to be listening on port 5173.

5. Launch Electron as a background process (starts Express in-process):
   ```bash
   cd /c/Users/mikes/Documents/CardMaker && npx electron .
   ```

6. Confirm Express is listening on port 3001 and the Electron window opens.

## Important
- Do NOT start a standalone Express server — Electron runs it in-process.
- Electron window loads from Vite (localhost:5173) in dev mode for HMR.
- Vite proxies `/api`, `/output`, `/games` to Express on port 3001.
