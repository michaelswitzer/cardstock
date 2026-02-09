import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { LocalDefaults } from '@cardmaker/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULTS_PATH = path.join(PROJECT_ROOT, '.cardmaker-defaults.json');

export const defaultsRouter = Router();

const EMPTY_DEFAULTS: LocalDefaults = { version: 1 };

/**
 * GET /api/defaults
 * Returns the saved defaults, or { version: 1 } if none exist.
 */
defaultsRouter.get('/', async (_req, res, next) => {
  try {
    const raw = await fs.readFile(DEFAULTS_PATH, 'utf-8');
    res.json(JSON.parse(raw));
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.json(EMPTY_DEFAULTS);
    } else {
      next(err);
    }
  }
});

/**
 * PUT /api/defaults
 * Saves defaults to .cardmaker-defaults.json.
 */
defaultsRouter.put('/', async (req, res, next) => {
  try {
    const body = req.body as LocalDefaults;
    if (!body || typeof body.version !== 'number') {
      res.status(400).json({ error: 'Missing required field: version' });
      return;
    }
    await fs.writeFile(DEFAULTS_PATH, JSON.stringify(body, null, 2), 'utf-8');
    res.json(body);
  } catch (err) {
    next(err);
  }
});
