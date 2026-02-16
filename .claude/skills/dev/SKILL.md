---
name: dev
description: Start the CardMaker development environment (server + client)
disable-model-invocation: true
allowed-tools: Bash
argument-hint: [start|stop|restart]
---

Manage the CardMaker dev servers. The argument determines the action:
- `start` (default if no argument): start both servers
- `stop`: stop both servers
- `restart`: stop then start both servers

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

2. Start the server as a background process:
   ```bash
   cd /c/Users/mikes/Documents/CardMaker/server && npx tsx src/index.ts
   ```
   Wait for it to print "Cardstock server running on http://localhost:3001" before proceeding.

3. Start the client as a background process:
   ```bash
   cd /c/Users/mikes/Documents/CardMaker/client && npx vite
   ```

Report the status of both processes when done.

## Important Notes
- Do NOT use `npm run dev` (concurrently) — tsx watch often fails silently under it.
- Server runs on port 3001, client on port 5173.
- Client proxies `/api` and `/output` to the server automatically.
