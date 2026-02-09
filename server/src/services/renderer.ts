import puppeteer, { type Browser, type Page } from 'puppeteer';
import sharp from 'sharp';
import {
  RENDER_SCALE,
  CARD_WIDTH_CSS,
  CARD_HEIGHT_CSS,
  TARGET_DPI,
  PAGE_POOL_SIZE,
} from '@cardmaker/shared';

let browser: Browser | null = null;

// Page pool: each page can render one card at a time
const available: Page[] = [];
const waiters: ((page: Page) => void)[] = [];
let poolSize = 0;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    available.length = 0;
    poolSize = 0;
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function createPage(): Promise<Page> {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setViewport({
    width: CARD_WIDTH_CSS,
    height: CARD_HEIGHT_CSS,
    deviceScaleFactor: RENDER_SCALE,
  });
  return page;
}

async function acquirePage(): Promise<Page> {
  // Check for an available page that's still open
  while (available.length > 0) {
    const page = available.pop()!;
    if (!page.isClosed()) return page;
    poolSize--;
  }
  // Create a new page if pool isn't full
  if (poolSize < PAGE_POOL_SIZE) {
    poolSize++;
    return createPage();
  }
  // Wait for a page to be released
  return new Promise<Page>(resolve => waiters.push(resolve));
}

function releasePage(page: Page) {
  if (page.isClosed()) {
    poolSize--;
    return;
  }
  const waiter = waiters.shift();
  if (waiter) {
    waiter(page);
  } else {
    available.push(page);
  }
}

/**
 * Pre-warm the browser and pool so the first render isn't slow.
 */
export async function warmUp(): Promise<void> {
  const pages = await Promise.all(
    Array.from({ length: PAGE_POOL_SIZE }, () => createPage())
  );
  poolSize = PAGE_POOL_SIZE;
  available.push(...pages);
  console.log(`Puppeteer warm: browser and ${PAGE_POOL_SIZE} pages ready`);
}

/**
 * Core screenshot function. Acquires a page from the pool,
 * renders the HTML, takes a screenshot, then releases the page.
 */
async function screenshotCard(html: string): Promise<Buffer> {
  const page = await acquirePage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: CARD_WIDTH_CSS, height: CARD_HEIGHT_CSS },
    });

    return Buffer.from(screenshot);
  } finally {
    releasePage(page);
  }
}

/**
 * Renders an HTML string to a PNG buffer at 300 DPI (for export).
 */
export async function renderCardToPng(html: string): Promise<Buffer> {
  const buffer = await screenshotCard(html);
  return sharp(buffer)
    .withMetadata({ density: TARGET_DPI })
    .png()
    .toBuffer();
}

/**
 * Lightweight preview render — returns a base64 data URL.
 */
export async function renderCardToDataUrl(html: string): Promise<string> {
  const buffer = await screenshotCard(html);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

/**
 * Cleanup: close the browser when shutting down.
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    available.length = 0;
    poolSize = 0;
  }
}

process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);
