import puppeteer, { type Browser, type Page } from 'puppeteer';
import sharp from 'sharp';
import {
  RENDER_SCALE,
  CARD_WIDTH_CSS,
  CARD_HEIGHT_CSS,
  CARD_WIDTH_PX,
  CARD_HEIGHT_PX,
  TARGET_DPI,
  PAGE_POOL_SIZE,
} from '@cardmaker/shared';

let browser: Browser | null = null;
const pagePool: Page[] = [];
const pageAvailable: (() => void)[] = [];

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function acquirePage(): Promise<Page> {
  if (pagePool.length > 0) {
    return pagePool.pop()!;
  }

  const b = await getBrowser();
  const allPages = await b.pages();
  if (allPages.length < PAGE_POOL_SIZE) {
    return b.newPage();
  }

  // Wait for a page to become available
  return new Promise<Page>((resolve) => {
    pageAvailable.push(() => resolve(pagePool.pop()!));
  });
}

function releasePage(page: Page) {
  pagePool.push(page);
  const waiter = pageAvailable.shift();
  if (waiter) waiter();
}

/**
 * Renders an HTML string to a PNG buffer at 300 DPI.
 */
export async function renderCardToPng(html: string): Promise<Buffer> {
  const page = await acquirePage();

  try {
    await page.setViewport({
      width: CARD_WIDTH_CSS,
      height: CARD_HEIGHT_CSS,
      deviceScaleFactor: RENDER_SCALE,
    });

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const screenshot = await page.screenshot({
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: CARD_WIDTH_CSS,
        height: CARD_HEIGHT_CSS,
      },
    });

    // Embed DPI metadata using sharp
    const buffer = Buffer.from(screenshot);
    const withDpi = await sharp(buffer)
      .png({ quality: 100 })
      .withMetadata({ density: TARGET_DPI })
      .resize(CARD_WIDTH_PX, CARD_HEIGHT_PX, { fit: 'fill' })
      .toBuffer();

    return withDpi;
  } finally {
    releasePage(page);
  }
}

/**
 * Renders card HTML and returns a base64 data URL for previews.
 */
export async function renderCardToDataUrl(html: string): Promise<string> {
  const png = await renderCardToPng(html);
  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * Cleanup: close the browser when shutting down.
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    pagePool.length = 0;
  }
}

process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);
