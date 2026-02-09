/** Render scale: Puppeteer deviceScaleFactor for 300 DPI output */
export const RENDER_SCALE = 3;

/** Target DPI for print output */
export const TARGET_DPI = 300;

/** Standard card dimensions in inches */
export const CARD_WIDTH_INCHES = 2.5;
export const CARD_HEIGHT_INCHES = 3.5;

/** CSS pixels at 1:1 (100 CSS px = 1 inch) */
export const CARD_WIDTH_CSS = CARD_WIDTH_INCHES * 100;  // 250
export const CARD_HEIGHT_CSS = CARD_HEIGHT_INCHES * 100; // 350

/** Final output pixels at 300 DPI */
export const CARD_WIDTH_PX = CARD_WIDTH_CSS * RENDER_SCALE;   // 750
export const CARD_HEIGHT_PX = CARD_HEIGHT_CSS * RENDER_SCALE;  // 1050

/** TTS sprite sheet limits */
export const TTS_MAX_COLUMNS = 10;
export const TTS_MAX_ROWS = 7;
export const TTS_MAX_CARDS = TTS_MAX_COLUMNS * TTS_MAX_ROWS; // 70

/** PDF page sizes in points (72 pts = 1 inch) */
export const PDF_PAGE_SIZES = {
  letter: { width: 612, height: 792 },   // 8.5 x 11 inches
  a4: { width: 595.28, height: 841.89 }, // 210 x 297 mm
} as const;

/** Crop mark length in points */
export const CROP_MARK_LENGTH = 18; // 0.25 inch

/** Margin around cards on PDF page in points */
export const PDF_MARGIN = 36; // 0.5 inch

/** Server config */
export const SERVER_PORT = 3001;
export const CLIENT_PORT = 5173;

/** Puppeteer page pool size */
export const PAGE_POOL_SIZE = 4;
