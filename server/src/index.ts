import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { SERVER_PORT } from '@cardmaker/shared';
import { sheetsRouter } from './routes/sheets.js';
import { cardsRouter } from './routes/cards.js';
import { exportRouter } from './routes/export.js';
import { templatesRouter } from './routes/templates.js';
import { gamesRouter } from './routes/games.js';
import { decksRouter } from './routes/decks.js';
import { errorHandler } from './middleware/errorHandler.js';
import { warmUp } from './services/renderer.js';
import { migrateDefaults, initGameIndex } from './services/dataStore.js';
import { TEMPLATES_DIR } from './services/templateEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.CARDMAKER_DATA_ROOT
  ?? path.resolve(__dirname, '..', '..');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve per-game files (artwork, cardbacks, icons, covers)
// Only accessed directly by Puppeteer (localhost:3001); client uses API endpoints
app.use('/games', express.static(path.join(PROJECT_ROOT, 'games')));

// Serve template assets (borders, backgrounds, textures bundled with templates)
app.use('/templates', express.static(TEMPLATES_DIR));

// Serve export output files
const OUTPUT_DIR = process.env.CARDMAKER_OUTPUT_DIR
  ?? path.join(PROJECT_ROOT, 'output');
app.use('/output', express.static(OUTPUT_DIR));

// Serve built client in production/Electron mode
const clientDist = process.env.CARDMAKER_CLIENT_DIST;
if (clientDist) {
  app.use(express.static(clientDist));
}

// API routes
app.use('/api/sheets', sheetsRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/export', exportRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/games', gamesRouter);
app.use('/api', decksRouter);

// SPA fallback — serve index.html for non-API routes when serving client
if (clientDist) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

export { app };

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : SERVER_PORT;

// Migrate old defaults on startup, then start listening
migrateDefaults()
  .catch((err) => console.warn('Migration check failed:', err.message))
  .then(() => {
    app.listen(port, () => {
      console.log(`Cardstock server running on http://localhost:${port}`);
      warmUp().catch((err) => console.warn('Puppeteer warm-up failed:', err.message));
    });
  });
