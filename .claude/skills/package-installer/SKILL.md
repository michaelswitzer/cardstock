---
name: package-installer
description: Build and package the Cardstock desktop installer. Defaults to current platform; pass "windows" or "macOS" to target a specific OS.
disable-model-invocation: true
allowed-tools: Bash
---

Package Cardstock as a standalone desktop installer.

## Arguments

- No argument → build for the current platform (auto-detect)
- `windows` or `win` → build Windows NSIS installer (.exe)
- `macOS` or `mac` → build macOS DMG installer (.dmg)

## Steps

### Determine the target

Check the skill arguments. Map them to the dist script argument:
- No args or empty → omit the argument (auto-detect)
- "windows", "win" → `win`
- "macos", "mac" → `mac`
- Anything else → tell the user the valid options and stop

### Run the build

```bash
cd C:\Users\mikes\Documents\CardMaker && node scripts/dist.js <target>
```

Where `<target>` is `win`, `mac`, or omitted for auto-detect.

This command:
1. Builds all workspaces (shared -> server -> client)
2. Compiles Electron main process (ESM) and preload (CommonJS, separate tsconfig)
3. Copies client dist for bundling
4. Downloads Chrome for Testing (puppeteer-core runtime)
5. On Windows: pre-populates the winCodeSign cache
6. Runs electron-builder for the target platform

**Note:** macOS builds can only be produced on macOS, and Windows builds can only be produced on Windows. If the build fails due to cross-compilation, inform the user they need to run it on the target platform.

## After Build

Report the full path and file size of the generated installer. Verify it built successfully:

```bash
ls -lh "C:\Users\mikes\Documents\CardMaker\dist-electron\Cardstock Setup"*.exe 2>/dev/null
ls -lh "C:\Users\mikes\Documents\CardMaker\dist-electron/"*.dmg 2>/dev/null
```

Only report whichever file type was actually built.

## Common Issues

- **winCodeSign symlink errors**: The `scripts/setup-codesign-cache.js` script handles this automatically. It skips entirely on non-Windows platforms.
- **Port conflicts**: If the build fails with port errors, kill stale node processes first.
- **Chrome download**: Chrome for Testing is downloaded to `./chrome/` and bundled in `extraResources/chrome/`.
- **asar is disabled**: ESM dynamic imports don't work inside asar archives, so the app uses unpacked files.
- **Cross-compilation**: electron-builder cannot cross-compile between Windows and macOS. Each platform must be built on its native OS.
