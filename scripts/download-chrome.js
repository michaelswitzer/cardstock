/**
 * Downloads Chrome for Testing into ./chrome/ for use with puppeteer-core.
 * Run once: node scripts/download-chrome.js
 * The script prints the executable path on completion.
 */
import { install, resolveBuildId, Browser, detectBrowserPlatform } from '@puppeteer/browsers';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const cacheDir = path.join(projectRoot, 'chrome');

const platform = detectBrowserPlatform();
if (!platform) {
  console.error('Could not detect browser platform');
  process.exit(1);
}

const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');

console.log(`Downloading Chrome ${buildId} for ${platform}...`);

const result = await install({
  browser: Browser.CHROME,
  buildId,
  cacheDir,
  platform,
});

console.log(`Chrome installed to: ${result.executablePath}`);
console.log(`\nSet this env var for dev:\n  PUPPETEER_EXECUTABLE_PATH=${result.executablePath}`);
