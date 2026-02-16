---
name: build
description: Build all workspaces (shared, server, client) or a specific one
disable-model-invocation: true
allowed-tools: Bash
argument-hint: [shared|server|client or blank for all]
---

Build the CardMaker project. If an argument is provided, build only that workspace. Otherwise, build all workspaces in dependency order.

## Build Order

Shared must be built first when types change, since both server and client depend on it.

### Build all:
```bash
npm run build
```
This runs `shared → server → client` in the correct order.

### Build a specific workspace:
```bash
npm run build -w $ARGUMENTS
```

## Common Build Issues

- **Shared type errors**: If `shared/` fails, fix the types there first. Server and client cannot build without it.
- **`composite: true` required**: Both `shared/tsconfig.json` and `client/tsconfig.node.json` must have `composite: true`.
- **React 19 `useRef`**: All `useRef` calls require an initial argument (e.g., `useRef<HTMLDivElement>(null)`).
- **Images router types**: The images router uses `mergeParams: true` and needs explicit `Request<{ gameId: string }>` type annotations.

Report success or failure with any error output.
