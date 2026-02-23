import { PDFDocument, rgb } from 'pdf-lib';
import {
  CARD_WIDTH_INCHES,
  CARD_HEIGHT_INCHES,
  PDF_PAGE_SIZES,
  CROP_MARK_LENGTH,
  PDF_MARGIN,
} from '@cardmaker/shared';

interface PdfOptions {
  pageSize: 'letter' | 'a4';
  cropMarks: boolean;
  cardWidthInches?: number;
  cardHeightInches?: number;
}

/**
 * Composes card PNG buffers onto print-ready PDF pages.
 */
export async function composePdf(
  cardPngs: Buffer[],
  options: PdfOptions
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pageSpec = PDF_PAGE_SIZES[options.pageSize];

  const cardWidthPts = (options.cardWidthInches ?? CARD_WIDTH_INCHES) * 72;
  const cardHeightPts = (options.cardHeightInches ?? CARD_HEIGHT_INCHES) * 72;

  // Calculate grid: how many cards fit per page
  const usableWidth = pageSpec.width - 2 * PDF_MARGIN;
  const usableHeight = pageSpec.height - 2 * PDF_MARGIN;
  const cols = Math.floor(usableWidth / cardWidthPts);
  const rows = Math.floor(usableHeight / cardHeightPts);
  const cardsPerPage = cols * rows;

  // Center the grid on the page
  const gridWidth = cols * cardWidthPts;
  const gridHeight = rows * cardHeightPts;
  const offsetX = (pageSpec.width - gridWidth) / 2;
  const offsetY = (pageSpec.height - gridHeight) / 2;

  for (let i = 0; i < cardPngs.length; i += cardsPerPage) {
    const page = pdf.addPage([pageSpec.width, pageSpec.height]);
    const batch = cardPngs.slice(i, i + cardsPerPage);

    for (let j = 0; j < batch.length; j++) {
      const col = j % cols;
      const row = Math.floor(j / cols);

      const x = offsetX + col * cardWidthPts;
      // PDF y-axis is bottom-up
      const y = pageSpec.height - offsetY - (row + 1) * cardHeightPts;

      const image = await pdf.embedPng(batch[j]);
      page.drawImage(image, {
        x,
        y,
        width: cardWidthPts,
        height: cardHeightPts,
      });

      if (options.cropMarks) {
        drawCropMarks(page, x, y, cardWidthPts, cardHeightPts);
      }
    }
  }

  return pdf.save();
}

function drawCropMarks(
  page: ReturnType<PDFDocument['addPage']>,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const len = CROP_MARK_LENGTH;
  const color = rgb(0, 0, 0);
  const thickness = 0.5;

  // Corners: top-left, top-right, bottom-left, bottom-right
  const corners = [
    { cx: x, cy: y + h },       // top-left
    { cx: x + w, cy: y + h },   // top-right
    { cx: x, cy: y },           // bottom-left
    { cx: x + w, cy: y },       // bottom-right
  ];

  for (const { cx, cy } of corners) {
    const hDir = cx === x ? -1 : 1;
    const vDir = cy === y ? -1 : 1;

    // Horizontal mark
    page.drawLine({
      start: { x: cx + hDir * 2, y: cy },
      end: { x: cx + hDir * (2 + len), y: cy },
      thickness,
      color,
    });
    // Vertical mark
    page.drawLine({
      start: { x: cx, y: cy + vDir * 2 },
      end: { x: cx, y: cy + vDir * (2 + len) },
      thickness,
      color,
    });
  }
}
