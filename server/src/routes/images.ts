import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTWORK_DIR = path.resolve(__dirname, '..', '..', '..', 'artwork');

export const imagesRouter = Router();

/**
 * GET /api/images
 * Lists all image files in the artwork directory, recursively including subdirectories.
 */
imagesRouter.get('/', async (_req, res, next) => {
  try {
    await fs.mkdir(ARTWORK_DIR, { recursive: true });
    const images: string[] = [];

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(entry.name)) {
          images.push(path.relative(ARTWORK_DIR, fullPath).replace(/\\/g, '/'));
        }
      }
    }

    await walk(ARTWORK_DIR);
    res.json({ images });
  } catch (err) {
    next(err);
  }
});
