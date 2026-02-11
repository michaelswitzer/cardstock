import { create } from 'zustand';
import type { CardData, ExportFormat } from '@cardmaker/shared';

interface DeckCache {
  headers: string[];
  rows: CardData[];
  cardImages: string[];
  cardImagesKey: string;
}

interface AppState {
  activeGameId: string | null;
  activeDeckId: string | null;
  deckDataCache: Record<string, DeckCache>;
  exportFormat: ExportFormat;

  // Actions
  setActiveGame: (gameId: string | null) => void;
  setActiveDeck: (deckId: string | null) => void;
  setDeckData: (deckId: string, headers: string[], rows: CardData[]) => void;
  setDeckCardImages: (deckId: string, images: string[], key: string) => void;
  clearDeckCache: (deckId: string) => void;
  setExportFormat: (format: ExportFormat) => void;
  reset: () => void;
}

const initialState = {
  activeGameId: null as string | null,
  activeDeckId: null as string | null,
  deckDataCache: {} as Record<string, DeckCache>,
  exportFormat: 'png' as ExportFormat,
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

  reset: () => set(initialState),
}));
