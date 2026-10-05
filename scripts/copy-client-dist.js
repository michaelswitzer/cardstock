/**
 * Copies client/dist/ into app/web/dist/, where the Go binary embeds it.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const src = path.join(projectRoot, 'client', 'dist');
const dest = path.join(projectRoot, 'app', 'web', 'dist');

if (!fs.existsSync(src)) {
  console.error('client/dist/ does not exist. Run npm run build first.');
  process.exit(1);
}

for (const entry of fs.readdirSync(dest, { withFileTypes: true })) {
  if (entry.name !== '.gitkeep') fs.rmSync(path.join(dest, entry.name), { recursive: true, force: true });
}
fs.cpSync(src, dest, { recursive: true });
console.log('Copied client/dist/ → app/web/dist/');
