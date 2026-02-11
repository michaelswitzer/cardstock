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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve per-game files (artwork, cardbacks, icons, covers)
// Only accessed directly by Puppeteer (localhost:3001); client uses API endpoints
app.use('/games', express.static(path.join(PROJECT_ROOT, 'games')));

// Serve export output files
app.use('/output', express.static(path.join(PROJECT_ROOT, 'output')));

// API routes
app.use('/api/sheets', sheetsRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/export', exportRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/games', gamesRouter);
app.use('/api', decksRouter);

// Error handler
app.use(errorHandler);

// Migrate old defaults on startup, then start listening
migrateDefaults()
  .catch((err) => console.warn('Migration check failed:', err.message))
  .then(() => {
    app.listen(SERVER_PORT, () => {
      console.log(`Cardstock server running on http://localhost:${SERVER_PORT}`);
      warmUp().catch((err) => console.warn('Puppeteer warm-up failed:', err.message));
    });
  });
