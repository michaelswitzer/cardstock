import { Router } from 'express';
import type { CardData, FieldMapping } from '@cardmaker/shared';
import { SERVER_PORT } from '@cardmaker/shared';
import { buildCardPage } from '../services/templateEngine.js';
import { renderCardToDataUrl } from '../services/renderer.js';
import { getGameSlug } from '../services/dataStore.js';

export const cardsRouter = Router();

function artworkUrl(gameId?: string): string {
  if (gameId) {
    const slug = getGameSlug(gameId);
    if (slug) return `http://localhost:${SERVER_PORT}/games/${slug}`;
  }
  // Fallback: no game context — images won't resolve, text still works
  return `http://localhost:${SERVER_PORT}/games/_none`;
}

/**
 * POST /api/cards/preview
 * Renders a single card preview and returns a data URL.
 * Body: { templateId, cardData, mapping, gameId? }
 */
cardsRouter.post('/preview', async (req, res, next) => {
  try {
    const { templateId, cardData, mapping, gameId } = req.body as {
      templateId: string;
      cardData: CardData;
      mapping: FieldMapping;
      gameId?: string;
    };

    if (!templateId || !cardData || !mapping) {
      res.status(400).json({ error: 'Missing required fields: templateId, cardData, mapping' });
      return;
    }

    const artworkBaseUrl = artworkUrl(gameId);
    const html = await buildCardPage(templateId, cardData, mapping, artworkBaseUrl);
    const dataUrl = await renderCardToDataUrl(html);

    res.json({ dataUrl });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cards/preview-batch
 * Renders cards in parallel using the page pool.
 * Body: { templateId, cards, mapping, gameId? }
 * Returns: { dataUrls: string[] }
 */
cardsRouter.post('/preview-batch', async (req, res, next) => {
  try {
    const { templateId, cards, mapping, gameId } = req.body as {
      templateId: string;
      cards: CardData[];
      mapping: FieldMapping;
      gameId?: string;
    };

    if (!templateId || !cards || !mapping) {
      res.status(400).json({ error: 'Missing required fields: templateId, cards, mapping' });
      return;
    }

    const artworkBaseUrl = artworkUrl(gameId);

    const dataUrls = await Promise.all(
      cards.map(async (card) => {
        const html = await buildCardPage(templateId, card, mapping, artworkBaseUrl);
        return renderCardToDataUrl(html);
      })
    );

    res.json({ dataUrls });
  } catch (err) {
    next(err);
  }
});
