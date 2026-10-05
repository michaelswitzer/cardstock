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
import type { CardSizePresetName } from '@cardmaker/shared';

export interface CardDimsInput {
  cardSizePreset?: CardSizePresetName;
  cardWidthInches?: number;
  cardHeightInches?: number;
  landscape?: boolean;
}

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

export async function createTemplate(input: {
  id: string;
  manifest: string;
  html: string;
  css: string;
}) {
  const { data } = await api.post('/templates', input);
  return data;
}

export async function updateTemplate(
  id: string,
  input: { manifest: string; html: string; css: string }
) {
  const { data } = await api.put(`/templates/${id}`, input);
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/templates/${id}`);
}

export async function openTemplatesFolder(): Promise<void> {
  await api.post('/templates/open-folder');
}

// --- Images (game-scoped) ---

export async function fetchImages(gameId: string): Promise<ImageListResponse> {
  const { data } = await api.get(`/games/${gameId}/images`);
  return data;
}

export async function fetchCovers(gameId: string): Promise<ImageListResponse> {
  const { data } = await api.get(`/games/${gameId}/images/covers`);
  return data;
}

export async function fetchCardbacks(gameId: string): Promise<ImageListResponse> {
  const { data } = await api.get(`/games/${gameId}/images/cardbacks`);
  return data;
}

export async function uploadCoverImage(gameId: string, file: File): Promise<Game> {
  const form = new FormData();
  form.append('cover', file);
  const { data } = await api.post(`/games/${gameId}/images/upload-cover`, form);
  return data;
}

// --- Card Rendering ---

export async function renderPreview(
  templateId: string,
  cardData: CardData,
  mapping: FieldMapping,
  gameId?: string,
  dims?: CardDimsInput
): Promise<string> {
  const { data } = await api.post('/cards/preview', {
    templateId,
    cardData,
    mapping,
    gameId,
    ...dims,
  });
  return data.dataUrl;
}

export async function renderPreviewBatch(
  templateId: string,
  cards: CardData[],
  mapping: FieldMapping,
  gameId?: string,
  dims?: CardDimsInput
): Promise<string[]> {
  const { data } = await api.post('/cards/preview-batch', {
    templateId,
    cards,
    mapping,
    gameId,
    ...dims,
  });
  return data.dataUrls;
}

// --- Export ---

export async function startExport(
  templateId: string,
  cards: CardData[],
  mapping: FieldMapping,
  options: ExportOptions,
  gameId: string,
  dims?: CardDimsInput
): Promise<string> {
  const { data } = await api.post('/export', {
    templateId,
    cards,
    mapping,
    options,
    gameId,
    ...dims,
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

export async function openGameFolder(id: string): Promise<void> {
  await api.post(`/games/${id}/open-folder`);
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
    cardSizePreset?: CardSizePresetName;
    cardWidthInches?: number;
    cardHeightInches?: number;
    landscape?: boolean;
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
  updates: Partial<Pick<Deck, 'name' | 'sheetTabGid' | 'sheetTabName' | 'templateId' | 'mapping' | 'cardBackImage' | 'cardSizePreset' | 'cardWidthInches' | 'cardHeightInches' | 'landscape'>>
): Promise<Deck> {
  const { data } = await api.put(`/decks/${id}`, updates);
  return data;
}

export async function deleteDeck(id: string): Promise<void> {
  await api.delete(`/decks/${id}`);
}

// --- App shell (data folder, renderer status, lifecycle) ---

export interface RendererStatus {
  state: 'idle' | 'starting' | 'downloading' | 'ready' | 'error';
  progress?: number;
  /** Downloading without progress info (fetching Chromium through Nix on NixOS). */
  indeterminate?: boolean;
  browser?: string;
  error?: string;
  /** Folder a download is going into. */
  target?: string;
  /** Set when this run downloaded the renderer, so the UI can confirm where it went. */
  downloaded?: { path: string; bytes?: number; nix?: boolean };
}

export async function getAppInfo(): Promise<{ dataFolder: string; defaultDataFolder: string }> {
  const { data } = await api.get('/app/info');
  return data;
}

export async function getAppStatus(): Promise<{ renderer: RendererStatus }> {
  const { data } = await api.get('/app/status');
  return data;
}

export async function openRendererFolder(): Promise<void> {
  await api.post('/app/open-renderer-folder');
}

/** Opens a native folder picker on the machine running Cardstock. Resolves to '' if cancelled. */
export async function pickFolder(): Promise<string> {
  const { data } = await api.post('/app/pick-folder');
  return data.path;
}

export async function setDataFolder(path: string): Promise<{ dataFolder: string }> {
  const { data } = await api.post('/app/data-folder', { path });
  return data;
}

/** Keeps the app alive while a window is open; it shuts down shortly after the last one closes. */
export function startHeartbeat(): () => void {
  const beat = () => api.post('/app/heartbeat').catch(() => {});
  const bye = () => navigator.sendBeacon('/api/app/bye');
  beat();
  const id = window.setInterval(beat, 5000);
  window.addEventListener('pagehide', bye);
  return () => {
    window.clearInterval(id);
    window.removeEventListener('pagehide', bye);
  };
}
