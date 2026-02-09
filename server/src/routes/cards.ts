import { Router } from 'express';
import type { CardData, FieldMapping } from '@cardmaker/shared';
import { SERVER_PORT } from '@cardmaker/shared';
import { buildCardPage } from '../services/templateEngine.js';
import { renderCardToDataUrl } from '../services/renderer.js';

export const cardsRouter = Router();

/**
 * POST /api/cards/preview
 * Renders a single card preview and returns a data URL.
 * Body: { templateId, cardData, mapping }
 */
cardsRouter.post('/preview', async (req, res, next) => {
  try {
    const { templateId, cardData, mapping } = req.body as {
      templateId: string;
      cardData: CardData;
      mapping: FieldMapping;
    };

    if (!templateId || !cardData || !mapping) {
      res.status(400).json({ error: 'Missing required fields: templateId, cardData, mapping' });
      return;
    }

    const artworkBaseUrl = `http://localhost:${SERVER_PORT}/artwork`;
    const html = await buildCardPage(templateId, cardData, mapping, artworkBaseUrl);
    const dataUrl = await renderCardToDataUrl(html);

    res.json({ dataUrl });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cards/preview-batch
 * Renders all cards sequentially on a single page for reliability.
 * Body: { templateId, cards, mapping }
 * Returns: { dataUrls: string[] }
 */
cardsRouter.post('/preview-batch', async (req, res, next) => {
  try {
    const { templateId, cards, mapping } = req.body as {
      templateId: string;
      cards: CardData[];
      mapping: FieldMapping;
    };

    if (!templateId || !cards || !mapping) {
      res.status(400).json({ error: 'Missing required fields: templateId, cards, mapping' });
      return;
    }

    const artworkBaseUrl = `http://localhost:${SERVER_PORT}/artwork`;

    const dataUrls: string[] = [];
    for (const card of cards) {
      const html = await buildCardPage(templateId, card, mapping, artworkBaseUrl);
      const dataUrl = await renderCardToDataUrl(html);
      dataUrls.push(dataUrl);
    }

    res.json({ dataUrls });
  } catch (err) {
    next(err);
  }
});
