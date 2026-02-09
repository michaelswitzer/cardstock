import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CardData, CardTemplate, FieldMapping } from '@cardmaker/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', 'templates');

export async function listTemplates(): Promise<CardTemplate[]> {
  const entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
  const templates: CardTemplate[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const manifestPath = path.join(TEMPLATES_DIR, entry.name, 'manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
      templates.push({ ...manifest, id: entry.name });
    } catch {
      // Skip directories without valid manifest
    }
  }

  return templates;
}

export async function getTemplate(id: string): Promise<CardTemplate> {
  const manifestPath = path.join(TEMPLATES_DIR, id, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
  return { ...manifest, id };
}

export async function loadTemplateHTML(id: string): Promise<string> {
  const htmlPath = path.join(TEMPLATES_DIR, id, 'template.html');
  return fs.readFile(htmlPath, 'utf-8');
}

export async function loadTemplateCSS(id: string): Promise<string> {
  const cssPath = path.join(TEMPLATES_DIR, id, 'template.css');
  return fs.readFile(cssPath, 'utf-8');
}

/**
 * Hydrates a template with card data using field mappings.
 * Replaces {{fieldName}} with mapped sheet column values.
 * Replaces {{image:slotName}} with artwork image URLs.
 */
export function hydrateTemplate(
  html: string,
  cardData: CardData,
  mapping: FieldMapping,
  artworkBaseUrl: string
): string {
  let result = html;

  // Replace {{fieldName}} placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, fieldName: string) => {
    const sheetColumn = mapping[fieldName];
    if (sheetColumn && cardData[sheetColumn] !== undefined) {
      return escapeHtml(cardData[sheetColumn]);
    }
    return '';
  });

  // Replace {{image:slotName}} placeholders
  result = result.replace(/\{\{image:(\w+)\}\}/g, (_match, slotName: string) => {
    const sheetColumn = mapping[slotName];
    if (sheetColumn && cardData[sheetColumn]) {
      const filename = cardData[sheetColumn];
      return `${artworkBaseUrl}/${filename.split('/').map(encodeURIComponent).join('/')}`;
    }
    return '';
  });

  // Replace {icon:name} with inline images from resources/
  result = result.replace(/\{icon:(\w+)\}/g, (_match, name: string) => {
    return `<img src="${artworkBaseUrl}/resources/${encodeURIComponent(name)}.png" class="inline-icon" />`;
  });

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Builds a full HTML page for rendering a single card.
 */
export async function buildCardPage(
  templateId: string,
  cardData: CardData,
  mapping: FieldMapping,
  artworkBaseUrl: string
): Promise<string> {
  const [templateHtml, templateCss] = await Promise.all([
    loadTemplateHTML(templateId),
    loadTemplateCSS(templateId),
  ]);

  const hydratedBody = hydrateTemplate(templateHtml, cardData, mapping, artworkBaseUrl);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
.inline-icon { height: 1em; width: auto; vertical-align: middle; display: inline; }
${templateCss}
</style>
</head>
<body>
${hydratedBody}
</body>
</html>`;
}
