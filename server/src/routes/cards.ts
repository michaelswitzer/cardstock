import { Router } from 'express';
import type { CardData, FieldMapping } from '@cardmaker/shared';
import {
  SERVER_PORT,
  CARD_WIDTH_INCHES,
  CARD_HEIGHT_INCHES,
  CARD_SIZE_PRESETS,
  resolveCardDimensions,
  type CardSizePresetName,
} from '@cardmaker/shared';
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

function resolveBodyDims(body: {
  cardSizePreset?: CardSizePresetName;
  cardWidthInches?: number;
  cardHeightInches?: number;
  landscape?: boolean;
}) {
  const preset = body.cardSizePreset;
  let w = CARD_WIDTH_INCHES;
  let h = CARD_HEIGHT_INCHES;
  if (preset && preset !== 'custom' && CARD_SIZE_PRESETS[preset]) {
    w = CARD_SIZE_PRESETS[preset].width;
    h = CARD_SIZE_PRESETS[preset].height;
  } else if (preset === 'custom' && body.cardWidthInches && body.cardHeightInches) {
    w = body.cardWidthInches;
    h = body.cardHeightInches;
  }
  return resolveCardDimensions(w, h, body.landscape);
}

/**
 * POST /api/cards/preview
 * Renders a single card preview and returns a data URL.
 * Body: { templateId, cardData, mapping, gameId?, cardSizePreset?, cardWidthInches?, cardHeightInches?, landscape? }
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

    const dims = resolveBodyDims(req.body);
    const artworkBaseUrl = artworkUrl(gameId);
    const html = await buildCardPage(templateId, cardData, mapping, artworkBaseUrl, dims.widthCss, dims.heightCss);
    const dataUrl = await renderCardToDataUrl(html, dims.widthCss, dims.heightCss);

    res.json({ dataUrl });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cards/preview-batch
 * Renders cards in parallel using the page pool.
 * Body: { templateId, cards, mapping, gameId?, cardSizePreset?, cardWidthInches?, cardHeightInches?, landscape? }
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

    const dims = resolveBodyDims(req.body);
    const artworkBaseUrl = artworkUrl(gameId);

    const dataUrls = await Promise.all(
      cards.map(async (card) => {
        const html = await buildCardPage(templateId, card, mapping, artworkBaseUrl, dims.widthCss, dims.heightCss);
        return renderCardToDataUrl(html, dims.widthCss, dims.heightCss);
      })
    );

    res.json({ dataUrls });
  } catch (err) {
    next(err);
  }
});
