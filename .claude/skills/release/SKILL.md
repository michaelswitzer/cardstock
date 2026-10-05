---
name: release
description: Build the standalone Cardstock release archives for Windows, macOS and Linux.
disable-model-invocation: true
allowed-tools: Bash
argument-hint: "[windows|macos|linux or blank for all]"
---

Package Cardstock as unzip-and-run archives. Go cross-compiles every platform from any OS, so no target machine is needed.

## Run

All platforms:
```bash
npm run release
```

One platform family (after `npm run build`):
```bash
node scripts/go.js run ./tools/release -only <windows|macos|linux>
```

The version comes from the root `package.json`. Archives are written to `app/dist/`:
- `Cardstock-<v>-windows-x64.zip` → `Cardstock/Cardstock.exe`
- `Cardstock-<v>-macos-{arm64,x64}.zip` → `Cardstock/Cardstock.app`
- `Cardstock-<v>-linux-{x64,arm64}.tar.gz` → `Cardstock/cardstock`

## After Build

Report each archive's path and size (`ls -lh app/dist/`).

## Notes
- The Windows icon/manifest is embedded with go-winres (fetched via `go run`, needs network).
- Builds are unsigned. macOS users right-click → Open on first launch; Windows SmartScreen shows "More info → Run anyway".
