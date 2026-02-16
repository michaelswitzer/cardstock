/**
 * Copies client/dist/ to client-dist/ at project root for Electron packaging.
 * electron-builder bundles client-dist/ into the asar, and the server serves it
 * when CARDMAKER_CLIENT_DIST is set.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const src = path.join(projectRoot, 'client', 'dist');
const dest = path.join(projectRoot, 'client-dist');

if (!fs.existsSync(src)) {
  console.error('client/dist/ does not exist. Run npm run build first.');
  process.exit(1);
}

fs.cpSync(src, dest, { recursive: true });
console.log(`Copied client/dist/ → client-dist/`);
