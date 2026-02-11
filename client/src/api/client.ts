import axios from 'axios';
import type {
  CardData,
  Deck,
  ExportJob,
  ExportOptions,
  FieldMapping,
  Game,
  ImageListResponse,
  SheetResponse,
  SheetTabsResponse,
  TemplateListResponse,
} from '@cardmaker/shared';

const api = axios.create({ baseURL: '/api' });

// --- Sheets ---

export async function fetchSheetData(url: string): Promise<SheetResponse> {
  const { data } = await api.get('/sheets/fetch', { params: { url } });
  return data;
}

export async function discoverSheetTabs(url: string): Promise<SheetTabsResponse> {
  const { data } = await api.get('/sheets/tabs', { params: { url } });
  return data;
}

// --- Templates ---

export async function fetchTemplates(): Promise<TemplateListResponse> {
  const { data } = await api.get('/templates');
  return data;
}

export async function fetchTemplate(id: string) {
  const { data } = await api.get(`/templates/${id}`);
  return data;
}

// --- Images ---

export async function fetchImages(): Promise<ImageListResponse> {
  const { data } = await api.get('/images');
  return data;
}

export async function fetchCardbacks(): Promise<ImageListResponse> {
  const { data } = await api.get('/images/cardbacks');
  return data;
}

// --- Card Rendering ---

export async function renderPreview(
  templateId: string,
  cardData: CardData,
  mapping: FieldMapping
): Promise<string> {
  const { data } = await api.post('/cards/preview', {
    templateId,
    cardData,
    mapping,
  });
  return data.dataUrl;
}

export async function renderPreviewBatch(
  templateId: string,
  cards: CardData[],
  mapping: FieldMapping
): Promise<string[]> {
  const { data } = await api.post('/cards/preview-batch', {
    templateId,
    cards,
    mapping,
  });
  return data.dataUrls;
}

// --- Export ---

export async function startExport(
  templateId: string,
  cards: CardData[],
  mapping: FieldMapping,
  options: ExportOptions
): Promise<string> {
  const { data } = await api.post('/export', {
    templateId,
    cards,
    mapping,
    options,
  });
  return data.jobId;
}

export async function startGameExport(
  gameId: string,
  options: ExportOptions
): Promise<string> {
  const { data } = await api.post('/export/game', { gameId, options });
  return data.jobId;
}

export async function getExportJob(jobId: string): Promise<ExportJob> {
  const { data } = await api.get(`/export/${jobId}`);
  return data;
}

// --- Games ---

export async function fetchGames(): Promise<{ games: Game[] }> {
  const { data } = await api.get('/games');
  return data;
}

export async function createGame(input: {
  title: string;
  description?: string;
  coverImage?: string;
  sheetUrl: string;
}): Promise<Game> {
  const { data } = await api.post('/games', input);
  return data;
}

export async function fetchGame(id: string): Promise<{ game: Game; decks: Deck[] }> {
  const { data } = await api.get(`/games/${id}`);
  return data;
}

export async function updateGame(
  id: string,
  updates: Partial<Pick<Game, 'title' | 'description' | 'coverImage' | 'sheetUrl'>>
): Promise<Game> {
  const { data } = await api.put(`/games/${id}`, updates);
  return data;
}

export async function deleteGame(id: string): Promise<void> {
  await api.delete(`/games/${id}`);
}

// --- Decks ---

export async function fetchDecks(gameId: string): Promise<{ decks: Deck[] }> {
  const { data } = await api.get(`/games/${gameId}/decks`);
  return data;
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
): Promise<Deck> {
  const { data } = await api.post(`/games/${gameId}/decks`, input);
  return data;
}

export async function fetchDeck(id: string): Promise<Deck> {
  const { data } = await api.get(`/decks/${id}`);
  return data;
}

export async function updateDeck(
  id: string,
  updates: Partial<Pick<Deck, 'name' | 'sheetTabGid' | 'sheetTabName' | 'templateId' | 'mapping' | 'cardBackImage'>>
): Promise<Deck> {
  const { data } = await api.put(`/decks/${id}`, updates);
  return data;
}

export async function deleteDeck(id: string): Promise<void> {
  await api.delete(`/decks/${id}`);
}
