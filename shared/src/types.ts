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
  error?: string;
}

/** Saved local defaults for the wizard */
export interface LocalDefaults {
  version: number;
  sheetUrl?: string;
  defaultTemplateId?: string;
  mappings?: Record<string, FieldMapping>;
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
