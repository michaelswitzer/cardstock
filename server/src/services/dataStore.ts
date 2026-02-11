import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { AppData, Game, Deck, FieldMapping } from '@cardmaker/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_PATH = path.join(PROJECT_ROOT, '.cardmaker-data.json');
const OLD_DEFAULTS_PATH = path.join(PROJECT_ROOT, '.cardmaker-defaults.json');

const EMPTY_DATA: AppData = { version: 1, games: [], decks: [] };

async function readData(): Promise<AppData> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err: any) {
    if (err.code === 'ENOENT') return { ...EMPTY_DATA, games: [], decks: [] };
    throw err;
  }
}

async function writeData(data: AppData): Promise<void> {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Games ---

export async function listGames(): Promise<Game[]> {
  const data = await readData();
  return data.games;
}

export async function createGame(input: {
  title: string;
  description?: string;
  coverImage?: string;
  sheetUrl: string;
}): Promise<Game> {
  const data = await readData();
  const now = new Date().toISOString();
  const game: Game = {
    id: uuidv4(),
    title: input.title,
    description: input.description,
    coverImage: input.coverImage,
    sheetUrl: input.sheetUrl,
    deckIds: [],
    createdAt: now,
    updatedAt: now,
  };
  data.games.push(game);
  await writeData(data);
  return game;
}

export async function getGame(id: string): Promise<Game | undefined> {
  const data = await readData();
  return data.games.find((g) => g.id === id);
}

export async function updateGame(
  id: string,
  updates: Partial<Pick<Game, 'title' | 'description' | 'coverImage' | 'sheetUrl'>>
): Promise<Game | undefined> {
  const data = await readData();
  const game = data.games.find((g) => g.id === id);
  if (!game) return undefined;
  Object.assign(game, updates, { updatedAt: new Date().toISOString() });
  await writeData(data);
  return game;
}

export async function deleteGame(id: string): Promise<boolean> {
  const data = await readData();
  const idx = data.games.findIndex((g) => g.id === id);
  if (idx === -1) return false;
  const game = data.games[idx];
  // Cascade-delete decks
  data.decks = data.decks.filter((d) => !game.deckIds.includes(d.id));
  data.games.splice(idx, 1);
  await writeData(data);
  return true;
}

// --- Decks ---

export async function listDecks(gameId: string): Promise<Deck[]> {
  const data = await readData();
  return data.decks.filter((d) => d.gameId === gameId);
}

export async function createDeck(
  gameId: string,
  input: {
    name: string;
    sheetTabGid: string;
    sheetTabName: string;
    templateId: string;
    mapping: FieldMapping;
    cardBackImage?: string;
  }
): Promise<Deck | undefined> {
  const data = await readData();
  const game = data.games.find((g) => g.id === gameId);
  if (!game) return undefined;

  const now = new Date().toISOString();
  const deck: Deck = {
    id: uuidv4(),
    gameId,
    name: input.name,
    sheetTabGid: input.sheetTabGid,
    sheetTabName: input.sheetTabName,
    templateId: input.templateId,
    mapping: input.mapping,
    cardBackImage: input.cardBackImage,
    createdAt: now,
    updatedAt: now,
  };
  data.decks.push(deck);
  game.deckIds.push(deck.id);
  game.updatedAt = now;
  await writeData(data);
  return deck;
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const data = await readData();
  return data.decks.find((d) => d.id === id);
}

export async function updateDeck(
  id: string,
  updates: Partial<Pick<Deck, 'name' | 'sheetTabGid' | 'sheetTabName' | 'templateId' | 'mapping' | 'cardBackImage'>>
): Promise<Deck | undefined> {
  const data = await readData();
  const deck = data.decks.find((d) => d.id === id);
  if (!deck) return undefined;
  Object.assign(deck, updates, { updatedAt: new Date().toISOString() });
  await writeData(data);
  return deck;
}

export async function deleteDeck(id: string): Promise<boolean> {
  const data = await readData();
  const idx = data.decks.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  const deck = data.decks[idx];
  // Remove from parent game's deckIds
  const game = data.games.find((g) => g.id === deck.gameId);
  if (game) {
    game.deckIds = game.deckIds.filter((did) => did !== id);
    game.updatedAt = new Date().toISOString();
  }
  data.decks.splice(idx, 1);
  await writeData(data);
  return true;
}

// --- Migration ---

interface OldDefaults {
  version: number;
  sheetUrl?: string;
  defaultTemplateId?: string;
  mappings?: Record<string, FieldMapping>;
}

export async function migrateDefaults(): Promise<void> {
  // Only migrate if new data file doesn't exist and old one does
  try {
    await fs.access(DATA_PATH);
    return; // Already have data file, skip
  } catch {
    // Data file doesn't exist, continue
  }

  let oldDefaults: OldDefaults;
  try {
    const raw = await fs.readFile(OLD_DEFAULTS_PATH, 'utf-8');
    oldDefaults = JSON.parse(raw);
  } catch {
    return; // No old defaults either
  }

  if (!oldDefaults.sheetUrl || !oldDefaults.defaultTemplateId) return;

  const now = new Date().toISOString();
  const gameId = uuidv4();
  const deckId = uuidv4();
  const mapping = oldDefaults.mappings?.[oldDefaults.defaultTemplateId] ?? {};

  const data: AppData = {
    version: 1,
    games: [
      {
        id: gameId,
        title: 'Migrated Game',
        sheetUrl: oldDefaults.sheetUrl,
        deckIds: [deckId],
        createdAt: now,
        updatedAt: now,
      },
    ],
    decks: [
      {
        id: deckId,
        gameId,
        name: 'Migrated Deck',
        sheetTabGid: '0',
        sheetTabName: 'Sheet1',
        templateId: oldDefaults.defaultTemplateId,
        mapping,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  await writeData(data);
  // Rename old file as backup
  await fs.rename(OLD_DEFAULTS_PATH, OLD_DEFAULTS_PATH + '.bak');
  console.log('Migrated .cardmaker-defaults.json → .cardmaker-data.json');
}
