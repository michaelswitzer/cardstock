import sharp from 'sharp';
import {
  CARD_WIDTH_PX,
  CARD_HEIGHT_PX,
  TTS_MAX_COLUMNS,
  TTS_MAX_ROWS,
} from '@cardmaker/shared';

/**
 * Composes card PNGs into a TTS sprite sheet grid.
 * TTS expects a single image with cards laid out in a grid.
 */
export async function composeTtsSpriteSheet(
  cardPngs: Buffer[],
  columns?: number
): Promise<Buffer> {
  const count = cardPngs.length;
  const cols = Math.min(columns ?? Math.min(count, TTS_MAX_COLUMNS), TTS_MAX_COLUMNS);
  const rows = Math.min(Math.ceil(count / cols), TTS_MAX_ROWS);
  const totalCards = Math.min(count, cols * rows);

  const sheetWidth = cols * CARD_WIDTH_PX;
  const sheetHeight = rows * CARD_HEIGHT_PX;

  // Build composite input array
  const compositeInputs = [];
  for (let i = 0; i < totalCards; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    compositeInputs.push({
      input: cardPngs[i],
      left: col * CARD_WIDTH_PX,
      top: row * CARD_HEIGHT_PX,
    });
  }

  const spriteSheet = await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toBuffer();

  return spriteSheet;
}
