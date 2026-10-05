/**
 * Runs `go` inside app/ with CGO disabled (Cardstock is pure Go), so npm scripts
 * work the same in every shell, including Windows cmd.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const result = spawnSync('go', process.argv.slice(2), {
  cwd: path.resolve(__dirname, '..', 'app'),
  stdio: 'inherit',
  env: { ...process.env, CGO_ENABLED: '0' },
});
process.exit(result.status ?? 1);
