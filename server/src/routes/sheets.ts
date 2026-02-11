import { Router } from 'express';
import { fetchSheetData, discoverTabs } from '../services/googleSheets.js';

export const sheetsRouter = Router();

/**
 * GET /api/sheets/fetch?url=<google-sheet-url>
 * Fetches and parses a published Google Sheet as CSV.
 */
sheetsRouter.get('/fetch', async (req, res, next) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ error: 'Missing required query parameter: url' });
      return;
    }

    const data = await fetchSheetData(url);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sheets/tabs?url=<pubhtml-url>
 * Discovers available tabs in a published Google Sheet.
 */
sheetsRouter.get('/tabs', async (req, res, next) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ error: 'Missing required query parameter: url' });
      return;
    }

    const tabs = await discoverTabs(url);
    res.json({ tabs });
  } catch (err) {
    next(err);
  }
});
