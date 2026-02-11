import { Router } from 'express';
import {
  listGames,
  createGame,
  getGame,
  updateGame,
  deleteGame,
  listDecks,
} from '../services/dataStore.js';

export const gamesRouter = Router();

/** GET /api/games — list all games */
gamesRouter.get('/', async (_req, res, next) => {
  try {
    const games = await listGames();
    res.json({ games });
  } catch (err) {
    next(err);
  }
});

/** POST /api/games — create a game */
gamesRouter.post('/', async (req, res, next) => {
  try {
    const { title, description, coverImage, sheetUrl } = req.body;
    if (!title || !sheetUrl) {
      res.status(400).json({ error: 'title and sheetUrl are required' });
      return;
    }
    const game = await createGame({ title, description, coverImage, sheetUrl });
    res.status(201).json(game);
  } catch (err) {
    next(err);
  }
});

/** GET /api/games/:id — get game with its decks */
gamesRouter.get('/:id', async (req, res, next) => {
  try {
    const game = await getGame(req.params.id);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    const decks = await listDecks(game.id);
    res.json({ game, decks });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/games/:id — update game */
gamesRouter.put('/:id', async (req, res, next) => {
  try {
    const { title, description, coverImage, sheetUrl } = req.body;
    const game = await updateGame(req.params.id, { title, description, coverImage, sheetUrl });
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    res.json(game);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/games/:id — delete game and its decks */
gamesRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteGame(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
