import { Router } from 'express';
import {
  listDecks,
  createDeck,
  getDeck,
  updateDeck,
  deleteDeck,
  getGame,
} from '../services/dataStore.js';

export const decksRouter = Router();

/** GET /api/games/:gameId/decks — list decks for a game */
decksRouter.get('/games/:gameId/decks', async (req, res, next) => {
  try {
    const game = await getGame(req.params.gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    const decks = await listDecks(game.id);
    res.json({ decks });
  } catch (err) {
    next(err);
  }
});

/** POST /api/games/:gameId/decks — create a deck */
decksRouter.post('/games/:gameId/decks', async (req, res, next) => {
  try {
    const { name, sheetTabGid, sheetTabName, templateId, mapping, cardBackImage,
      cardSizePreset, cardWidthInches, cardHeightInches, landscape } = req.body;
    if (!name || !sheetTabGid || !sheetTabName || !templateId) {
      res.status(400).json({ error: 'name, sheetTabGid, sheetTabName, and templateId are required' });
      return;
    }
    const deck = await createDeck(req.params.gameId, {
      name,
      sheetTabGid,
      sheetTabName,
      templateId,
      mapping: mapping ?? {},
      cardBackImage,
      cardSizePreset,
      cardWidthInches,
      cardHeightInches,
      landscape,
    });
    if (!deck) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    res.status(201).json(deck);
  } catch (err) {
    next(err);
  }
});

/** GET /api/decks/:id — get a single deck */
decksRouter.get('/decks/:id', async (req, res, next) => {
  try {
    const deck = await getDeck(req.params.id);
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }
    res.json(deck);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/decks/:id — update a deck */
decksRouter.put('/decks/:id', async (req, res, next) => {
  try {
    const { name, sheetTabGid, sheetTabName, templateId, mapping, cardBackImage,
      cardSizePreset, cardWidthInches, cardHeightInches, landscape } = req.body;
    const deck = await updateDeck(req.params.id, {
      name,
      sheetTabGid,
      sheetTabName,
      templateId,
      mapping,
      cardBackImage,
      cardSizePreset,
      cardWidthInches,
      cardHeightInches,
      landscape,
    });
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }
    res.json(deck);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/decks/:id — delete a deck */
decksRouter.delete('/decks/:id', async (req, res, next) => {
  try {
    const deleted = await deleteDeck(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
