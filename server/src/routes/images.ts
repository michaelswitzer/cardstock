import { Router, type Request } from 'express';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getGameSlug, GAMES_DIR } from '../services/dataStore.js';

export const imagesRouter = Router({ mergeParams: true });

const IMAGE_RE = /\.(png|jpe?g|gif|svg|webp)$/i;

function resolveGameDir(gameId: string): string | null {
  const slug = getGameSlug(gameId);
  if (!slug) return null;
  return path.join(GAMES_DIR, slug);
}

/**
 * GET /api/games/:gameId/images
 * Lists all images recursively in the game's artwork/ directory.
 */
imagesRouter.get('/', async (req: Request<{ gameId: string }>, res, next) => {
  try {
    const gameDir = resolveGameDir(req.params.gameId);
    if (!gameDir) { res.status(404).json({ error: 'Game not found' }); return; }

    const artworkDir = path.join(gameDir, 'artwork');
    await fs.mkdir(artworkDir, { recursive: true });

    const images: string[] = [];
    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (IMAGE_RE.test(entry.name)) {
          images.push(path.relative(artworkDir, fullPath).replace(/\\/g, '/'));
        }
      }
    }

    await walk(artworkDir);
    res.json({ images });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/:gameId/images/covers
 * Lists image files at the root of the game folder (not in subdirectories).
 */
imagesRouter.get('/covers', async (req: Request<{ gameId: string }>, res, next) => {
  try {
    const gameDir = resolveGameDir(req.params.gameId);
    if (!gameDir) { res.status(404).json({ error: 'Game not found' }); return; }

    const images: string[] = [];
    const entries = await fs.readdir(gameDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && IMAGE_RE.test(entry.name)) {
        images.push(entry.name);
      }
    }
    res.json({ images });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/:gameId/images/cardbacks
 * Lists image files in the game's artwork/cardback/ directory.
 */
imagesRouter.get('/cardbacks', async (req: Request<{ gameId: string }>, res, next) => {
  try {
    const gameDir = resolveGameDir(req.params.gameId);
    if (!gameDir) { res.status(404).json({ error: 'Game not found' }); return; }

    const cardbackDir = path.join(gameDir, 'artwork', 'cardback');
    await fs.mkdir(cardbackDir, { recursive: true });

    const images: string[] = [];
    const entries = await fs.readdir(cardbackDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && IMAGE_RE.test(entry.name)) {
        images.push(entry.name);
      }
    }
    res.json({ images });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/:gameId/images/thumb/*
 * Serves a resized thumbnail of an image within the game folder.
 * Query params: w (width, default 150), h (height, default 210)
 * Path is relative to game dir, e.g. /api/games/:id/images/thumb/artwork/card.png
 */
const thumbCache = new Map<string, Buffer>();

imagesRouter.get('/thumb/*', async (req: Request<{ gameId: string; 0: string }>, res, next) => {
  try {
    const gameDir = resolveGameDir(req.params.gameId);
    if (!gameDir) { res.status(404).json({ error: 'Game not found' }); return; }

    const relPath = req.params[0];
    const w = Math.min(Number(req.query.w) || 150, 400);
    const h = Math.min(Number(req.query.h) || 210, 560);
    const cacheKey = `${req.params.gameId}:${relPath}:${w}x${h}`;

    let buffer = thumbCache.get(cacheKey);
    if (!buffer) {
      const fullPath = path.join(gameDir, relPath);
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
