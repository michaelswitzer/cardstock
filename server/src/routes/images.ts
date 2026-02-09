import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTWORK_DIR = path.resolve(__dirname, '..', '..', '..', 'artwork');

export const imagesRouter = Router();

/**
 * GET /api/images
 * Lists all image files in the artwork directory.
 */
imagesRouter.get('/', async (_req, res, next) => {
  try {
    await fs.mkdir(ARTWORK_DIR, { recursive: true });
    const files = await fs.readdir(ARTWORK_DIR);
    const images = files.filter((f) =>
      /\.(png|jpe?g|gif|svg|webp)$/i.test(f)
    );
    res.json({ images });
  } catch (err) {
    next(err);
  }
});
