---
name: restart-server
description: Restart the Express server after code changes. Use this automatically after modifying any server source files.
allowed-tools: Bash
---

Restart the CardMaker Express server. This is needed after any change to server source files (the server does NOT auto-reload when started with `npx tsx src/index.ts`).

Template HTML/CSS changes do NOT require a restart — they are read from disk on every render.

## Steps

1. Find the server process on port 3001:
   ```bash
   netstat -ano | findstr "LISTENING" | findstr ":3001"
   ```

2. Kill the process:
   ```bash
   taskkill //PID <pid> //F
   ```
   Use `//PID` not `/PID` (Git Bash on Windows).

3. Start the server as a background process:
   ```bash
   cd /c/Users/mikes/Documents/CardMaker/server && npx tsx src/index.ts
   ```

4. Confirm it prints "Cardstock server running on http://localhost:3001".
