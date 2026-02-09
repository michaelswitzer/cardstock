import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { CardData, ExportJob, ExportOptions, FieldMapping } from '@cardmaker/shared';
import { SERVER_PORT } from '@cardmaker/shared';
import { buildCardPage } from '../services/templateEngine.js';
import { renderCardToPng } from '../services/renderer.js';
import { composePdf } from '../services/pdfComposer.js';
import { composeTtsSpriteSheet } from '../services/ttsExporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', '..', '..', 'output');

export const exportRouter = Router();

// In-memory job store
const jobs = new Map<string, ExportJob>();

/**
 * POST /api/export
 * Starts an async export job.
 * Body: { templateId, cards, mapping, options }
 */
exportRouter.post('/', async (req, res) => {
  const { templateId, cards, mapping, options } = req.body as {
    templateId: string;
    cards: CardData[];
    mapping: FieldMapping;
    options: ExportOptions;
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
  runExport(jobId, templateId, selectedCards, mapping, options).catch((err) => {
    const j = jobs.get(jobId);
    if (j) {
      j.status = 'error';
      j.error = err.message;
    }
  });
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

async function runExport(
  jobId: string,
  templateId: string,
  cards: CardData[],
  mapping: FieldMapping,
  options: ExportOptions
) {
  const job = jobs.get(jobId)!;
  job.status = 'processing';

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const artworkBaseUrl = `http://localhost:${SERVER_PORT}/artwork`;

  // Render all cards to PNG
  const pngs: Buffer[] = [];
  for (let i = 0; i < cards.length; i++) {
    const html = await buildCardPage(templateId, cards[i], mapping, artworkBaseUrl);
    const png = await renderCardToPng(html);
    pngs.push(png);
    job.completed = i + 1;
    job.progress = Math.round(((i + 1) / cards.length) * (options.format === 'png' ? 100 : 80));
  }

  const timestamp = Date.now();

  if (options.format === 'png') {
    // Save individual PNGs to a folder
    const dir = path.join(OUTPUT_DIR, `cards-${timestamp}`);
    await fs.mkdir(dir, { recursive: true });
    for (let i = 0; i < pngs.length; i++) {
      await fs.writeFile(path.join(dir, `card-${i + 1}.png`), pngs[i]);
    }
    job.outputPath = dir;
    job.progress = 100;
  } else if (options.format === 'pdf') {
    const pdfBytes = await composePdf(pngs, {
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
    job.progress = 100;
  }

  job.status = 'complete';
}
