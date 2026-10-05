---
name: build
description: Build the client and the Cardstock Go binary
disable-model-invocation: true
allowed-tools: Bash
argument-hint: "[client|app or blank for both]"
---

Build Cardstock. The Go binary embeds the built client, so the client must be built first.

### Client only (shared types → client → copied into app/web/dist):
```bash
npm run build
```

### Client + Go binary for this machine (writes app/cardstock or app/cardstock.exe):
```bash
npm run app
```

### Go tests:
```bash
npm test
```

## Common Build Issues

- **Shared type errors**: `shared/` holds the client's TypeScript types and must build before the client.
- **"Client not built" page**: `app/web/dist` is empty; run `npm run build` before `go build`.
- **cgo / gcc errors**: run Go through `node scripts/go.js ...` (sets `CGO_ENABLED=0`) — the app has no C dependencies.
- **Go version**: the module needs Go 1.26+ (see `app/go.mod`).

Report success or failure with any error output.
