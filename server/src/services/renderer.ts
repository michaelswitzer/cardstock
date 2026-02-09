import puppeteer, { type Browser, type Page } from 'puppeteer';
import sharp from 'sharp';
import {
  RENDER_SCALE,
  CARD_WIDTH_CSS,
  CARD_HEIGHT_CSS,
  TARGET_DPI,
} from '@cardmaker/shared';

let browser: Browser | null = null;
let renderPage: Page | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    renderPage = null;
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function getPage(): Promise<Page> {
  if (renderPage && !renderPage.isClosed()) {
    return renderPage;
  }
  const b = await getBrowser();
  renderPage = await b.newPage();
  await renderPage.setViewport({
    width: CARD_WIDTH_CSS,
    height: CARD_HEIGHT_CSS,
    deviceScaleFactor: RENDER_SCALE,
  });
  return renderPage;
}

/**
 * Pre-warm the browser and page so the first render isn't slow.
 */
export async function warmUp(): Promise<void> {
  await getPage();
  console.log('Puppeteer warm: browser and page ready');
}

/**
 * Core screenshot function shared by preview and export paths.
 */
async function screenshotCard(html: string): Promise<Buffer> {
  const page = await getPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const screenshot = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: CARD_WIDTH_CSS, height: CARD_HEIGHT_CSS },
  });

  return Buffer.from(screenshot);
}

/**
 * Renders an HTML string to a PNG buffer at 300 DPI (for export).
 * Only embeds DPI metadata — Puppeteer already outputs at the correct pixel size.
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
 * Skips sharp entirely since previews don't need DPI metadata.
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
    renderPage = null;
  }
}

process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);
