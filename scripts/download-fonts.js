/**
 * Downloads Google Fonts (Urbanist, Nunito Sans) for offline use.
 * Run once: node scripts/download-fonts.js
 * Saves woff2 files to client/public/fonts/ and generates fonts.css.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.resolve(__dirname, '..', 'client', 'public', 'fonts');
fs.mkdirSync(fontsDir, { recursive: true });

const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800;900&family=Nunito+Sans:opsz,wght@6..12,400;6..12,500;6..12,600;6..12,700&display=swap';

// Fetch CSS with woff2 user-agent
const res = await fetch(GOOGLE_FONTS_URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
});
let css = await res.text();

// Find all url(...) references and download them
const urlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
let match;
let fileIndex = 0;
const replacements = [];

while ((match = urlRegex.exec(css)) !== null) {
  const url = match[1];
  const ext = url.includes('.woff2') ? '.woff2' : '.woff';
  const filename = `font-${fileIndex}${ext}`;
  fileIndex++;

  console.log(`Downloading ${filename}...`);
  const fontRes = await fetch(url);
  const buffer = Buffer.from(await fontRes.arrayBuffer());
  fs.writeFileSync(path.join(fontsDir, filename), buffer);

  replacements.push({ from: url, to: `/fonts/${filename}` });
}

// Replace URLs in CSS
for (const { from, to } of replacements) {
  css = css.replace(from, to);
}

fs.writeFileSync(path.join(fontsDir, 'fonts.css'), css);
console.log(`\nSaved ${fileIndex} font files and fonts.css to client/public/fonts/`);
