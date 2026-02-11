import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTWORK_DIR = path.resolve(__dirname, '..', '..', '..', 'artwork');
const CARDBACK_DIR = path.resolve(__dirname, '..', '..', '..', 'artwork', 'cardback');

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

/**
 * GET /api/images/cardbacks
 * Lists all image files in the cardback directory.
 */
imagesRouter.get('/cardbacks', async (_req, res, next) => {
  try {
    await fs.mkdir(CARDBACK_DIR, { recursive: true });
    const images: string[] = [];
    const entries = await fs.readdir(CARDBACK_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && /\.(png|jpe?g|gif|svg|webp)$/i.test(entry.name)) {
        images.push(entry.name);
      }
    }
    res.json({ images });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/images/thumb/*
 * Serves a resized thumbnail of an artwork image.
 * Query params: w (width, default 150), h (height, default 210)
 * Path is relative to artwork dir, e.g. /api/images/thumb/cardback/mycard.png
 */
const thumbCache = new Map<string, Buffer>();

imagesRouter.get('/thumb/*', async (req, res, next) => {
  try {
    const relPath = req.params[0];
    const w = Math.min(Number(req.query.w) || 150, 400);
    const h = Math.min(Number(req.query.h) || 210, 560);
    const cacheKey = `${relPath}:${w}x${h}`;

    let buffer = thumbCache.get(cacheKey);
    if (!buffer) {
      const fullPath = path.join(ARTWORK_DIR, relPath);
      buffer = await sharp(fullPath)
        .resize(w, h, { fit: 'inside' })
        .png()
        .toBuffer();
      thumbCache.set(cacheKey, buffer);
    }

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
