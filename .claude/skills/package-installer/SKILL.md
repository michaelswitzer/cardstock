---
name: package-installer
description: Build and package the Cardstock Windows installer (.exe). Use when the user wants to create a distributable build.
disable-model-invocation: true
allowed-tools: Bash
---

Package Cardstock as a standalone Windows installer.

## Steps

Run the full dist build:

```bash
cd C:\Users\mikes\Documents\CardMaker && npm run dist
```

This command:
1. Builds all workspaces (shared -> server -> client)
2. Compiles Electron main process (ESM) and preload (CommonJS, separate tsconfig)
3. Copies client dist for bundling
4. Downloads Chrome for Testing (puppeteer-core runtime)
5. Pre-populates the winCodeSign cache (works around Windows symlink privilege issue)
6. Runs electron-builder to produce an NSIS installer

The installer is output to `dist-electron/Cardstock Setup <version>.exe`.

## After Build

Report the full path and file size of the generated `.exe` installer. Verify it built successfully by checking the file exists.

```bash
ls -lh "C:\Users\mikes\Documents\CardMaker\dist-electron\Cardstock Setup"*.exe
```

## Common Issues

- **winCodeSign symlink errors**: The `scripts/setup-codesign-cache.js` script handles this automatically by pre-extracting the cache and creating dummy files for macOS symlinks that can't be created on Windows.
- **Port conflicts**: If the build fails with port errors, kill stale node processes first.
- **Chrome download**: Chrome for Testing is downloaded to `./chrome/` and bundled in `extraResources/chrome/`.
- **asar is disabled**: ESM dynamic imports don't work inside asar archives, so the app uses unpacked files.
