import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { AppData, Game, Deck, GameFile, StoredDeck, FieldMapping } from '@cardmaker/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.CARDMAKER_DATA_ROOT
  ?? path.resolve(__dirname, '..', '..', '..');
const GAMES_DIR = path.join(PROJECT_ROOT, 'games');
const DATA_PATH = path.join(PROJECT_ROOT, '.cardmaker-data.json');
const OLD_DEFAULTS_PATH = path.join(PROJECT_ROOT, '.cardmaker-defaults.json');

export { GAMES_DIR };

// In-memory indexes for fast lookup
const gameIndex = new Map<string, string>(); // gameId → slug
const deckIndex = new Map<string, string>(); // deckId → gameId

// --- Slug helpers ---

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'game';
}

function uniqueSlug(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// --- File I/O ---

async function readGameFile(slug: string): Promise<GameFile> {
  const filePath = path.join(GAMES_DIR, slug, 'game.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeGameFile(slug: string, data: GameFile): Promise<void> {
  const filePath = path.join(GAMES_DIR, slug, 'game.json');
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function gameFileToGame(gf: GameFile): Game {
  return {
    id: gf.id,
    title: gf.title,
    slug: gf.slug,
    description: gf.description,
    coverImage: gf.coverImage,
    sheetUrl: gf.sheetUrl,
    deckCount: gf.decks.length,
    createdAt: gf.createdAt,
    updatedAt: gf.updatedAt,
  };
}

function storedDeckToDeck(sd: StoredDeck, gameId: string): Deck {
  return {
    ...sd,
    gameId,
  };
}

// --- Index initialization ---

export async function initGameIndex(): Promise<void> {
  gameIndex.clear();
  deckIndex.clear();

  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(GAMES_DIR, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const gf = await readGameFile(entry.name);
      gameIndex.set(gf.id, entry.name);
      for (const deck of gf.decks) {
        deckIndex.set(deck.id, gf.id);
      }
    } catch {
      // Skip invalid game directories
    }
  }
}

// --- Slug lookup ---

export function getGameSlug(gameId: string): string | undefined {
  return gameIndex.get(gameId);
}

// --- Games ---

export async function listGames(): Promise<Game[]> {
  const games: Game[] = [];
  for (const [, slug] of gameIndex) {
    try {
      const gf = await readGameFile(slug);
      games.push(gameFileToGame(gf));
    } catch {
      // skip
    }
  }
  return games;
}

export async function getGame(id: string): Promise<Game | undefined> {
  const slug = gameIndex.get(id);
  if (!slug) return undefined;
  try {
    const gf = await readGameFile(slug);
    return gameFileToGame(gf);
  } catch {
    return undefined;
  }
}

export async function createGame(input: {
  title: string;
  description?: string;
  sheetUrl: string;
}): Promise<Game> {
  const existingSlugs = new Set(gameIndex.values());
  const slug = uniqueSlug(slugify(input.title), existingSlugs);

  const now = new Date().toISOString();
  const gameFile: GameFile = {
    id: uuidv4(),
    title: input.title,
    slug,
    description: input.description,
    sheetUrl: input.sheetUrl,
    createdAt: now,
    updatedAt: now,
    decks: [],
  };

  const gameDir = path.join(GAMES_DIR, slug);
  await fs.mkdir(path.join(gameDir, 'artwork', 'cardart'), { recursive: true });
  await fs.mkdir(path.join(gameDir, 'artwork', 'cardback'), { recursive: true });
  await fs.mkdir(path.join(gameDir, 'artwork', 'icons'), { recursive: true });
  await writeGameFile(slug, gameFile);

  gameIndex.set(gameFile.id, slug);
  return gameFileToGame(gameFile);
}

export async function updateGame(
  id: string,
  updates: Partial<Pick<Game, 'title' | 'description' | 'coverImage' | 'sheetUrl'>>
): Promise<Game | undefined> {
  const slug = gameIndex.get(id);
  if (!slug) return undefined;

  const gf = await readGameFile(slug);
  if (updates.title !== undefined) gf.title = updates.title;
  if (updates.description !== undefined) gf.description = updates.description;
  if (updates.coverImage !== undefined) gf.coverImage = updates.coverImage;
  if (updates.sheetUrl !== undefined) gf.sheetUrl = updates.sheetUrl;
  gf.updatedAt = new Date().toISOString();

  await writeGameFile(slug, gf);
  return gameFileToGame(gf);
}

export async function deleteGame(id: string): Promise<boolean> {
  const slug = gameIndex.get(id);
  if (!slug) return false;

  // Remove deck index entries
  try {
    const gf = await readGameFile(slug);
    for (const deck of gf.decks) {
      deckIndex.delete(deck.id);
    }
  } catch {
    // If can't read, just clean up what we can
  }

  // Remove game directory
  await fs.rm(path.join(GAMES_DIR, slug), { recursive: true, force: true });
  gameIndex.delete(id);
  return true;
}

// --- Decks ---

export async function listDecks(gameId: string): Promise<Deck[]> {
  const slug = gameIndex.get(gameId);
  if (!slug) return [];
  try {
    const gf = await readGameFile(slug);
    return gf.decks.map((sd) => storedDeckToDeck(sd, gameId));
  } catch {
    return [];
  }
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
  const slug = gameIndex.get(gameId);
  if (!slug) return undefined;

  const gf = await readGameFile(slug);
  const now = new Date().toISOString();
  const storedDeck: StoredDeck = {
    id: uuidv4(),
    name: input.name,
    sheetTabGid: input.sheetTabGid,
    sheetTabName: input.sheetTabName,
    templateId: input.templateId,
    mapping: input.mapping,
    cardBackImage: input.cardBackImage,
    createdAt: now,
    updatedAt: now,
  };

  gf.decks.push(storedDeck);
  gf.updatedAt = now;
  await writeGameFile(slug, gf);

  deckIndex.set(storedDeck.id, gameId);
  return storedDeckToDeck(storedDeck, gameId);
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const gameId = deckIndex.get(id);
  if (!gameId) return undefined;
  const slug = gameIndex.get(gameId);
  if (!slug) return undefined;

  const gf = await readGameFile(slug);
  const sd = gf.decks.find((d) => d.id === id);
  if (!sd) return undefined;
  return storedDeckToDeck(sd, gameId);
}

export async function updateDeck(
  id: string,
  updates: Partial<Pick<Deck, 'name' | 'sheetTabGid' | 'sheetTabName' | 'templateId' | 'mapping' | 'cardBackImage'>>
): Promise<Deck | undefined> {
  const gameId = deckIndex.get(id);
  if (!gameId) return undefined;
  const slug = gameIndex.get(gameId);
  if (!slug) return undefined;

  const gf = await readGameFile(slug);
  const sd = gf.decks.find((d) => d.id === id);
  if (!sd) return undefined;

  if (updates.name !== undefined) sd.name = updates.name;
  if (updates.sheetTabGid !== undefined) sd.sheetTabGid = updates.sheetTabGid;
  if (updates.sheetTabName !== undefined) sd.sheetTabName = updates.sheetTabName;
  if (updates.templateId !== undefined) sd.templateId = updates.templateId;
  if (updates.mapping !== undefined) sd.mapping = updates.mapping;
  if (updates.cardBackImage !== undefined) sd.cardBackImage = updates.cardBackImage;
  sd.updatedAt = new Date().toISOString();
  gf.updatedAt = sd.updatedAt;

  await writeGameFile(slug, gf);
  return storedDeckToDeck(sd, gameId);
}

export async function deleteDeck(id: string): Promise<boolean> {
  const gameId = deckIndex.get(id);
  if (!gameId) return false;
  const slug = gameIndex.get(gameId);
  if (!slug) return false;

  const gf = await readGameFile(slug);
  const idx = gf.decks.findIndex((d) => d.id === id);
  if (idx === -1) return false;

  gf.decks.splice(idx, 1);
  gf.updatedAt = new Date().toISOString();
  await writeGameFile(slug, gf);

  deckIndex.delete(id);
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
  // First: migrate .cardmaker-defaults.json → .cardmaker-data.json (old chain)
  try {
    await fs.access(DATA_PATH);
  } catch {
    // No central data file — check for old defaults
    let oldDefaults: OldDefaults | undefined;
    try {
      const raw = await fs.readFile(OLD_DEFAULTS_PATH, 'utf-8');
      oldDefaults = JSON.parse(raw);
    } catch {
      // no old defaults either
    }

    if (oldDefaults?.sheetUrl && oldDefaults.defaultTemplateId) {
      const now = new Date().toISOString();
      const gameId = uuidv4();
      const deckId = uuidv4();
      const mapping = oldDefaults.mappings?.[oldDefaults.defaultTemplateId] ?? {};

      const centralData: AppData = {
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
      await fs.writeFile(DATA_PATH, JSON.stringify(centralData, null, 2), 'utf-8');
      await fs.rename(OLD_DEFAULTS_PATH, OLD_DEFAULTS_PATH + '.bak');
      console.log('Migrated .cardmaker-defaults.json → .cardmaker-data.json');
    }
  }

  // Now: migrate .cardmaker-data.json → per-game files
  let centralData: AppData | undefined;
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    centralData = JSON.parse(raw);
  } catch {
    // No central data file
  }

  if (!centralData || centralData.games.length === 0) {
    await initGameIndex();
    return;
  }

  const existingSlugs = new Set<string>();
  // Check for already-migrated game dirs
  try {
    const entries = await fs.readdir(GAMES_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) existingSlugs.add(e.name);
    }
  } catch {
    // empty
  }

  for (const oldGame of centralData.games) {
    const slug = uniqueSlug(slugify(oldGame.title), existingSlugs);
    existingSlugs.add(slug);

    const gameDecks: StoredDeck[] = centralData.decks
      .filter((d) => oldGame.deckIds.includes(d.id))
      .map((d) => ({
        id: d.id,
        name: d.name,
        sheetTabGid: d.sheetTabGid,
        sheetTabName: d.sheetTabName,
        templateId: d.templateId,
        mapping: d.mapping,
        cardBackImage: d.cardBackImage,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));

    const gameFile: GameFile = {
      id: oldGame.id,
      title: oldGame.title,
      slug,
      description: oldGame.description,
      coverImage: oldGame.coverImage,
      sheetUrl: oldGame.sheetUrl,
      createdAt: oldGame.createdAt,
      updatedAt: oldGame.updatedAt,
      decks: gameDecks,
    };

    const gameDir = path.join(GAMES_DIR, slug);
    await fs.mkdir(path.join(gameDir, 'artwork', 'cardart'), { recursive: true });
    await fs.mkdir(path.join(gameDir, 'artwork', 'cardback'), { recursive: true });
    await fs.mkdir(path.join(gameDir, 'artwork', 'icons'), { recursive: true });
    await writeGameFile(slug, gameFile);
  }

  // Rename old file as backup
  await fs.rename(DATA_PATH, DATA_PATH + '.bak');
  console.log('Migrated .cardmaker-data.json → per-game files in games/');

  await initGameIndex();
}
