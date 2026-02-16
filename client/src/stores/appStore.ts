import { create } from 'zustand';
import type { CardData, ExportFormat } from '@cardmaker/shared';

interface DeckCache {
  headers: string[];
  rows: CardData[];
  cardImages: string[];
  cardImagesKey: string;
}

type CardZoom = 160 | 240 | 360;

interface AppState {
  activeGameId: string | null;
  activeDeckId: string | null;
  deckDataCache: Record<string, DeckCache>;
  exportFormat: ExportFormat;
  sidebarCollapsed: boolean;
  cardZoom: CardZoom;

  // Actions
  setActiveGame: (gameId: string | null) => void;
  setActiveDeck: (deckId: string | null) => void;
  setDeckData: (deckId: string, headers: string[], rows: CardData[]) => void;
  setDeckCardImages: (deckId: string, images: string[], key: string) => void;
  clearDeckCache: (deckId: string) => void;
  setExportFormat: (format: ExportFormat) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCardZoom: (zoom: CardZoom) => void;
  reset: () => void;
}

const initialState = {
  activeGameId: null as string | null,
  activeDeckId: null as string | null,
  deckDataCache: {} as Record<string, DeckCache>,
  exportFormat: 'png' as ExportFormat,
  sidebarCollapsed: localStorage.getItem('sidebar-collapsed') === 'true',
  cardZoom: (Number(localStorage.getItem('card-zoom')) || 240) as CardZoom,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setActiveGame: (gameId) => set({ activeGameId: gameId }),

  setActiveDeck: (deckId) => set({ activeDeckId: deckId }),

  setDeckData: (deckId, headers, rows) =>
    set((state) => ({
      deckDataCache: {
        ...state.deckDataCache,
        [deckId]: {
          ...state.deckDataCache[deckId],
          headers,
          rows,
          cardImages: state.deckDataCache[deckId]?.cardImages ?? [],
          cardImagesKey: state.deckDataCache[deckId]?.cardImagesKey ?? '',
        },
      },
    })),

  setDeckCardImages: (deckId, images, key) =>
    set((state) => ({
      deckDataCache: {
        ...state.deckDataCache,
        [deckId]: {
          ...state.deckDataCache[deckId],
          headers: state.deckDataCache[deckId]?.headers ?? [],
          rows: state.deckDataCache[deckId]?.rows ?? [],
          cardImages: images,
          cardImagesKey: key,
        },
      },
    })),

  clearDeckCache: (deckId) =>
    set((state) => {
      const { [deckId]: _, ...rest } = state.deckDataCache;
      return { deckDataCache: rest };
    }),

  setExportFormat: (format) => set({ exportFormat: format }),

  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
    return set({ sidebarCollapsed: collapsed });
  },

  setCardZoom: (zoom) => {
    localStorage.setItem('card-zoom', String(zoom));
    return set({ cardZoom: zoom });
  },

  reset: () => set(initialState),
}));
