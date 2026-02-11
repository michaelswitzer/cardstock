import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import type { CardData, ExportJob, ExportOptions, FieldMapping } from '@cardmaker/shared';
import { SERVER_PORT, CARD_WIDTH_PX, CARD_HEIGHT_PX, TARGET_DPI } from '@cardmaker/shared';
import { buildCardPage } from '../services/templateEngine.js';
import { renderCardToPng } from '../services/renderer.js';
import { composePdf } from '../services/pdfComposer.js';
import { composeTtsSpriteSheet } from '../services/ttsExporter.js';
import { getGame, getGameSlug, listDecks, GAMES_DIR } from '../services/dataStore.js';
import { buildTabCsvUrl, fetchSheetData } from '../services/googleSheets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', '..', '..', 'output');

export const exportRouter = Router();

// In-memory job store
const jobs = new Map<string, ExportJob>();

function artworkUrl(gameId: string): string {
  const slug = getGameSlug(gameId);
  return `http://localhost:${SERVER_PORT}/games/${slug ?? '_none'}`;
}

function cardbackDir(gameId: string): string {
  const slug = getGameSlug(gameId);
  return path.join(GAMES_DIR, slug ?? '_none', 'artwork', 'cardback');
}

/**
 * POST /api/export
 * Starts an async export job.
 * Body: { templateId, cards, mapping, options, gameId }
 */
exportRouter.post('/', async (req, res) => {
  const { templateId, cards, mapping, options, gameId } = req.body as {
    templateId: string;
    cards: CardData[];
    mapping: FieldMapping;
    options: ExportOptions;
    gameId: string;
  };

  const selectedCards = options.selectedCards.length > 0
    ? options.selectedCards.map(i => cards[i])
    : cards;

  const jobId = uuidv4();
  const job: ExportJob = {
    id: jobId,
    status: 'queued',
    progress: 0,
    total: selectedCards.length,
    completed: 0,
    format: options.format,
  };
  jobs.set(jobId, job);

  res.json({ jobId });

  // Run export asynchronously
  runExport(jobId, templateId, selectedCards, mapping, options, gameId).catch((err) => {
    const j = jobs.get(jobId);
    if (j) {
      j.status = 'error';
      j.error = err.message;
    }
  });
});

/**
 * POST /api/export/game
 * Exports all decks in a game, each to a subfolder.
 * Body: { gameId, options }
 */
exportRouter.post('/game', async (req, res, next) => {
  try {
    const { gameId, options } = req.body as {
      gameId: string;
      options: ExportOptions;
    };

    const game = await getGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const decks = await listDecks(gameId);
    if (decks.length === 0) {
      res.status(400).json({ error: 'Game has no decks' });
      return;
    }

    // Count total cards across decks (estimated — we'll update as we go)
    const jobId = uuidv4();
    const job: ExportJob = {
      id: jobId,
      status: 'queued',
      progress: 0,
      total: 0,
      completed: 0,
      format: options.format,
      outputPaths: [],
    };
    jobs.set(jobId, job);

    res.json({ jobId });

    // Run full game export asynchronously
    runGameExport(jobId, game, decks, options).catch((err) => {
      const j = jobs.get(jobId);
      if (j) {
        j.status = 'error';
        j.error = err.message;
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/export/:jobId
 * Returns the status of an export job.
 */
exportRouter.get('/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(job);
});

async function renderCardBack(gameCardbackDir: string, cardBackImage: string): Promise<Buffer> {
  const imagePath = path.join(gameCardbackDir, cardBackImage);
  return sharp(imagePath)
    .resize(CARD_WIDTH_PX, CARD_HEIGHT_PX, { fit: 'cover' })
    .withMetadata({ density: TARGET_DPI })
    .png()
    .toBuffer();
}

async function runExport(
  jobId: string,
  templateId: string,
  cards: CardData[],
  mapping: FieldMapping,
  options: ExportOptions,
  gameId: string
) {
  const job = jobs.get(jobId)!;
  job.status = 'processing';

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const artworkBaseUrl = artworkUrl(gameId);
  const gameCardbackDir = cardbackDir(gameId);

  // Render all cards to PNG
  const pngs: Buffer[] = [];
  for (let i = 0; i < cards.length; i++) {
    const html = await buildCardPage(templateId, cards[i], mapping, artworkBaseUrl);
    const png = await renderCardToPng(html);
    pngs.push(png);
    job.completed = i + 1;
    job.progress = Math.round(((i + 1) / cards.length) * (options.format === 'png' ? 90 : 80));
  }

  // Render card back if requested
  let cardBackBuffer: Buffer | undefined;
  if (options.includeCardBack && options.cardBackImage) {
    cardBackBuffer = await renderCardBack(gameCardbackDir, options.cardBackImage);
  }

  const timestamp = Date.now();

  if (options.format === 'png') {
    const dir = path.join(OUTPUT_DIR, `cards-${timestamp}`);
    await fs.mkdir(dir, { recursive: true });
    for (let i = 0; i < pngs.length; i++) {
      await fs.writeFile(path.join(dir, `card-${i + 1}.png`), pngs[i]);
    }
    if (cardBackBuffer) {
      const backPath = path.join(dir, 'card-back.png');
      await fs.writeFile(backPath, cardBackBuffer);
      job.cardBackPath = backPath;
    }
    job.outputPath = dir;
    job.progress = 100;
  } else if (options.format === 'pdf') {
    const allPngs = cardBackBuffer ? [...pngs, cardBackBuffer] : pngs;
    const pdfBytes = await composePdf(allPngs, {
      pageSize: options.pdfPageSize ?? 'letter',
      cropMarks: options.pdfCropMarks ?? true,
    });
    const filename = `cards-${timestamp}.pdf`;
    await fs.writeFile(path.join(OUTPUT_DIR, filename), pdfBytes);
    job.outputPath = `/output/${filename}`;
    job.progress = 100;
  } else if (options.format === 'tts') {
    const spriteSheet = await composeTtsSpriteSheet(pngs, options.ttsColumns);
    const filename = `tts-sheet-${timestamp}.png`;
    await fs.writeFile(path.join(OUTPUT_DIR, filename), spriteSheet);
    job.outputPath = `/output/${filename}`;
    if (cardBackBuffer) {
      const backFilename = `tts-back-${timestamp}.png`;
      await fs.writeFile(path.join(OUTPUT_DIR, backFilename), cardBackBuffer);
      job.cardBackPath = `/output/${backFilename}`;
    }
    job.progress = 100;
  }

  job.status = 'complete';
}

async function runGameExport(
  jobId: string,
  game: import('@cardmaker/shared').Game,
  decks: import('@cardmaker/shared').Deck[],
  options: ExportOptions
) {
  const job = jobs.get(jobId)!;
  job.status = 'processing';

  const timestamp = Date.now();
  const safeTitle = game.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
  const gameDir = path.join(OUTPUT_DIR, `${safeTitle}-${timestamp}`);
  await fs.mkdir(gameDir, { recursive: true });

  const artworkBaseUrl = artworkUrl(game.id);
  const gameCardbackDir = cardbackDir(game.id);

  // First pass: fetch all deck data to get total card count
  const deckData: { deck: typeof decks[0]; cards: CardData[] }[] = [];
  for (const deck of decks) {
    const csvUrl = buildTabCsvUrl(game.sheetUrl, deck.sheetTabGid);
    const sheetData = await fetchSheetData(csvUrl);
    deckData.push({ deck, cards: sheetData.rows });
    job.total += sheetData.rows.length;
  }

  let totalCompleted = 0;

  for (const { deck, cards } of deckData) {
    const safeDeckName = deck.name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
    const deckDir = path.join(gameDir, safeDeckName);
    await fs.mkdir(deckDir, { recursive: true });

    // Render all cards in this deck
    const pngs: Buffer[] = [];
    for (let i = 0; i < cards.length; i++) {
      const html = await buildCardPage(deck.templateId, cards[i], deck.mapping, artworkBaseUrl);
      const png = await renderCardToPng(html);
      pngs.push(png);
      totalCompleted++;
      job.completed = totalCompleted;
      job.progress = Math.round((totalCompleted / job.total) * 80);
    }

    // Render card back if present
    let cardBackBuffer: Buffer | undefined;
    if (deck.cardBackImage) {
      cardBackBuffer = await renderCardBack(gameCardbackDir, deck.cardBackImage);
    }

    if (options.format === 'png') {
      for (let i = 0; i < pngs.length; i++) {
        await fs.writeFile(path.join(deckDir, `card-${i + 1}.png`), pngs[i]);
      }
      if (cardBackBuffer) {
        await fs.writeFile(path.join(deckDir, 'card-back.png'), cardBackBuffer);
      }
      job.outputPaths!.push(deckDir);
    } else if (options.format === 'pdf') {
      const allPngs = cardBackBuffer ? [...pngs, cardBackBuffer] : pngs;
      const pdfBytes = await composePdf(allPngs, {
        pageSize: options.pdfPageSize ?? 'letter',
        cropMarks: options.pdfCropMarks ?? true,
      });
      const filename = `${safeDeckName}.pdf`;
      await fs.writeFile(path.join(deckDir, filename), pdfBytes);
      job.outputPaths!.push(path.join(deckDir, filename));
    } else if (options.format === 'tts') {
      const spriteSheet = await composeTtsSpriteSheet(pngs, options.ttsColumns);
      const filename = `${safeDeckName}-tts.png`;
      await fs.writeFile(path.join(deckDir, filename), spriteSheet);
      if (cardBackBuffer) {
        await fs.writeFile(path.join(deckDir, `${safeDeckName}-back.png`), cardBackBuffer);
      }
      job.outputPaths!.push(deckDir);
    }
  }

  job.outputPath = gameDir;
  job.progress = 100;
  job.status = 'complete';
}
