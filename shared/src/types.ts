/** Raw row from a Google Sheet, keyed by column header */
export type CardData = Record<string, string>;

/** Google Sheet data source configuration */
export interface SheetSource {
  url: string;
  sheetName?: string;
}

/** Template manifest.json schema */
export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  width: number;   // in inches
  height: number;  // in inches
  fields: TemplateField[];
  imageSlots: ImageSlot[];
}

export interface TemplateField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'textarea';
  default?: string;
}

export interface ImageSlot {
  name: string;
  label: string;
  width: number;   // CSS px in template
  height: number;  // CSS px in template
}

/** Maps sheet columns to template fields */
export interface FieldMapping {
  [templateField: string]: string; // templateField → sheetColumn
}

/** Export format options */
export type ExportFormat = 'png' | 'pdf' | 'tts';

export interface ExportOptions {
  format: ExportFormat;
  /** Card indices to export (empty = all) */
  selectedCards: number[];
  /** TTS-specific: columns in sprite grid */
  ttsColumns?: number;
  /** PDF-specific: page size */
  pdfPageSize?: 'letter' | 'a4';
  /** PDF-specific: include crop marks */
  pdfCropMarks?: boolean;
  /** Include card back image in export */
  includeCardBack?: boolean;
  /** Artwork filename for the card back */
  cardBackImage?: string;
}

/** Tracks async export progress */
export interface ExportJob {
  id: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  progress: number;  // 0-100
  total: number;
  completed: number;
  format: ExportFormat;
  outputPath?: string;
  /** Path to exported card back image (when applicable) */
  cardBackPath?: string;
  /** All output file paths (for multi-file exports) */
  outputPaths?: string[];
  error?: string;
}

/** A tab (sheet) within a Google Sheets document */
export interface SheetTab {
  name: string;
  gid: string;
}

/** A game project tied to a Google Sheets document */
export interface Game {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  sheetUrl: string;
  deckIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** A deck pairs a sheet tab + template + field mapping */
export interface Deck {
  id: string;
  gameId: string;
  name: string;
  sheetTabGid: string;
  sheetTabName: string;
  templateId: string;
  mapping: FieldMapping;
  cardBackImage?: string;
  createdAt: string;
  updatedAt: string;
}

/** Persisted application data */
export interface AppData {
  version: number;
  games: Game[];
  decks: Deck[];
}

/** API response for sheet tab discovery */
export interface SheetTabsResponse {
  tabs: SheetTab[];
}

/** API response for sheet data */
export interface SheetResponse {
  headers: string[];
  rows: CardData[];
  rowCount: number;
}

/** API response for template list */
export interface TemplateListResponse {
  templates: CardTemplate[];
}

/** API response for image list */
export interface ImageListResponse {
  images: string[];
}
