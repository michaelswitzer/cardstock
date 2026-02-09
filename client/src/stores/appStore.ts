import { create } from 'zustand';
import type {
  CardData,
  CardTemplate,
  ExportFormat,
  FieldMapping,
} from '@cardmaker/shared';

interface AppState {
  // Step 1: Data Source
  sheetUrl: string;
  headers: string[];
  rows: CardData[];

  // Step 2: Template
  selectedTemplate: CardTemplate | null;
  mapping: FieldMapping;

  // Step 3: Preview
  selectedCards: number[];

  // Step 4: Export
  exportFormat: ExportFormat;

  // Actions
  setSheetUrl: (url: string) => void;
  setSheetData: (headers: string[], rows: CardData[]) => void;
  setTemplate: (template: CardTemplate) => void;
  setMapping: (mapping: FieldMapping) => void;
  setFieldMapping: (templateField: string, sheetColumn: string) => void;
  toggleCardSelection: (index: number) => void;
  selectAllCards: () => void;
  deselectAllCards: () => void;
  setExportFormat: (format: ExportFormat) => void;
  reset: () => void;
}

const initialState = {
  sheetUrl: '',
  headers: [],
  rows: [],
  selectedTemplate: null,
  mapping: {},
  selectedCards: [],
  exportFormat: 'png' as ExportFormat,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setSheetUrl: (url) => set({ sheetUrl: url }),

  setSheetData: (headers, rows) => set({ headers, rows }),

  setTemplate: (template) => set({ selectedTemplate: template, mapping: {} }),

  setMapping: (mapping) => set({ mapping }),

  setFieldMapping: (templateField, sheetColumn) =>
    set((state) => ({
      mapping: { ...state.mapping, [templateField]: sheetColumn },
    })),

  toggleCardSelection: (index) =>
    set((state) => {
      const selected = state.selectedCards.includes(index)
        ? state.selectedCards.filter((i) => i !== index)
        : [...state.selectedCards, index];
      return { selectedCards: selected };
    }),

  selectAllCards: () =>
    set((state) => ({
      selectedCards: state.rows.map((_, i) => i),
    })),

  deselectAllCards: () => set({ selectedCards: [] }),

  setExportFormat: (format) => set({ exportFormat: format }),

  reset: () => set(initialState),
}));
