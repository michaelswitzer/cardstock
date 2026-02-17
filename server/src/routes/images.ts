import { Router, type Request } from 'express';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import multer from 'multer';
import { getGameSlug, GAMES_DIR, updateGame } from '../services/dataStore.js';

export const imagesRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (IMAGE_RE.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (png, jpg, gif, svg, webp) are allowed'));
    }
  },
});

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

/**
 * POST /api/games/:gameId/images/upload-cover
 * Uploads a cover image to the game folder root and sets it as coverImage.
 */
imagesRouter.post(
  '/upload-cover',
  upload.single('cover'),
  async (req: Request<{ gameId: string }>, res, next) => {
    try {
      const gameDir = resolveGameDir(req.params.gameId);
      if (!gameDir) { res.status(404).json({ error: 'Game not found' }); return; }

      const file = req.file;
      if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

      const filename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const destPath = path.join(gameDir, filename);
      await fs.writeFile(destPath, file.buffer);

      const game = await updateGame(req.params.gameId, { coverImage: filename });
      if (!game) { res.status(404).json({ error: 'Game not found' }); return; }

      res.json(game);
    } catch (err) {
      next(err);
    }
  }
);
