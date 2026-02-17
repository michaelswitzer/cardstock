/**
 * Pre-populates the electron-builder winCodeSign cache.
 *
 * The winCodeSign-2.6.0.7z archive contains macOS symlinks that fail to
 * extract on Windows without Developer Mode / admin privileges. This script
 * extracts ignoring those errors and creates dummy files so the cache is valid.
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CACHE_DIR = join(
  homedir(),
  'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign'
);
const TARGET_DIR = join(CACHE_DIR, 'winCodeSign-2.6.0');
const MARKER = join(TARGET_DIR, 'rcedit-x64.exe');

if (existsSync(MARKER)) {
  console.log('winCodeSign cache already populated, skipping.');
  process.exit(0);
}

const URL =
  'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z';
const ARCHIVE = join(CACHE_DIR, 'winCodeSign-2.6.0.7z');

// Resolve the 7za binary from electron-builder's dependency
const SEVEN_ZIP = join(
  process.cwd(),
  'node_modules', '7zip-bin', 'win', 'x64', '7za.exe'
);

mkdirSync(CACHE_DIR, { recursive: true });

console.log('Downloading winCodeSign-2.6.0...');
execSync(`curl -L -o "${ARCHIVE}" "${URL}"`, { stdio: 'inherit' });

mkdirSync(TARGET_DIR, { recursive: true });

console.log('Extracting (ignoring macOS symlink errors)...');
try {
  execSync(`"${SEVEN_ZIP}" x -bd -y "${ARCHIVE}" "-o${TARGET_DIR}"`, {
    stdio: 'inherit',
  });
} catch {
  // Exit code 2 from 7-zip means the macOS symlinks failed — that's OK
}

// Create dummy files for the two macOS symlinks that fail
const darwinLib = join(TARGET_DIR, 'darwin', '10.12', 'lib');
mkdirSync(darwinLib, { recursive: true });
for (const name of ['libcrypto.dylib', 'libssl.dylib']) {
  const p = join(darwinLib, name);
  if (!existsSync(p)) writeFileSync(p, '');
}

if (existsSync(MARKER)) {
  console.log('winCodeSign cache ready.');
} else {
  console.error('ERROR: rcedit-x64.exe not found after extraction.');
  process.exit(1);
}
