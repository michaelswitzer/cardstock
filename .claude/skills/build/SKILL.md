---
name: build
description: Build all workspaces (shared, server, client) or a specific one
disable-model-invocation: true
allowed-tools: Bash
argument-hint: "[shared|server|client|electron|dist or blank for all]"
---

Build the CardMaker project. If an argument is provided, build only that workspace/target. Otherwise, build all workspaces in dependency order.

## Build Order

Shared must be built first when types change, since both server and client depend on it.

### Build all:
```bash
npm run build
```
This runs `shared -> server -> client` in the correct order.

### Build a specific workspace:
```bash
npm run build -w $ARGUMENTS
```

### Build for Electron:
```bash
npm run build:electron
```
This builds all workspaces, compiles the Electron main process, and copies the client dist for bundling.

### Package Electron installer:
```bash
npm run dist
```
This runs `build:electron`, downloads Chrome for Testing (if missing), and packages a Windows NSIS installer to `dist-electron/`.

## Common Build Issues

- **Shared type errors**: If `shared/` fails, fix the types there first. Server and client cannot build without it.
- **`composite: true` required**: Both `shared/tsconfig.json` and `client/tsconfig.node.json` must have `composite: true`.
- **React 19 `useRef`**: All `useRef` calls require an initial argument (e.g., `useRef<HTMLDivElement>(null)`).
- **Images router types**: The images router uses `mergeParams: true` and needs explicit `Request<{ gameId: string }>` type annotations.
- **Chrome for Testing**: The `dist` script auto-downloads Chrome. For dev, run `node scripts/download-chrome.js` once manually.

Report success or failure with any error output.
