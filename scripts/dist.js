/**
 * Platform-aware dist script.
 *
 * Usage:
 *   node scripts/dist.js          # auto-detect current platform
 *   node scripts/dist.js win      # force Windows build
 *   node scripts/dist.js mac      # force macOS build
 */
import { execSync } from 'child_process';
import { platform } from 'os';

const arg = (process.argv[2] || '').toLowerCase();

let target;
if (arg === 'win' || arg === 'windows') {
  target = 'win';
} else if (arg === 'mac' || arg === 'macos') {
  target = 'mac';
} else if (!arg) {
  target = platform() === 'darwin' ? 'mac' : 'win';
} else {
  console.error(`Unknown target "${arg}". Use: win, mac, or omit for auto-detect.`);
  process.exit(1);
}

const script = target === 'win' ? 'dist:win' : 'dist:mac';
console.log(`Building for ${target === 'win' ? 'Windows' : 'macOS'}...`);
execSync(`npm run ${script}`, { stdio: 'inherit' });
