import Papa from 'papaparse';
import type { CardData, SheetResponse, SheetTab } from '@cardmaker/shared';

/**
 * Converts a Google Sheets URL to its published CSV export URL.
 * If the URL is already a CSV export/publish URL, uses it directly.
 * Otherwise extracts the spreadsheet ID and builds the export URL.
 */
function toCSVUrl(url: string): string {
  // Already a CSV URL (export?format=csv or pub?output=csv)
  if (/[?&](format|output)=csv/i.test(url)) {
    return url;
  }

  // Extract spreadsheet ID from any Google Sheets URL
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error('Invalid Google Sheets URL. Could not extract spreadsheet ID.');
  }
  const spreadsheetId = match[1];

  // Extract gid (sheet tab) if present
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Builds a CSV export URL for a specific tab (by gid) of a Google Sheet.
 */
export function buildTabCsvUrl(baseUrl: string, gid: string): string {
  // Published URLs (/d/e/LONG_ID/...) use /pub?output=csv&gid=
  // Edit URLs (/d/SPREADSHEET_ID/...) use /export?format=csv&gid=
  const publishedMatch = baseUrl.match(/\/d\/(e\/[a-zA-Z0-9_-]+)/);
  if (publishedMatch) {
    return `https://docs.google.com/spreadsheets/d/${publishedMatch[1]}/pub?output=csv&gid=${gid}`;
  }
  const editMatch = baseUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!editMatch) {
    throw new Error('Invalid Google Sheets URL. Could not extract spreadsheet ID.');
  }
  return `https://docs.google.com/spreadsheets/d/${editMatch[1]}/export?format=csv&gid=${gid}`;
}

/**
 * Discovers available tabs in a published Google Sheet.
 * Fetches the pubhtml page and parses the embedded JS for tab info.
 */
export async function discoverTabs(url: string): Promise<SheetTab[]> {
  // Build the pubhtml URL from any sheets URL
  // Handle published URLs: /d/e/2PACX-LONG_ID/pub...
  // Handle edit URLs: /d/SPREADSHEET_ID/edit...
  const publishedMatch = url.match(/\/d\/(e\/[a-zA-Z0-9_-]+)/);
  const editMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const docPath = publishedMatch ? publishedMatch[1] : editMatch?.[1];
  if (!docPath) {
    throw new Error('Invalid Google Sheets URL. Could not extract spreadsheet ID.');
  }
  const pubhtmlUrl = `https://docs.google.com/spreadsheets/d/${docPath}/pubhtml`;

  const response = await fetch(pubhtmlUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to fetch pubhtml page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Parse items.push patterns from embedded JS
  // Actual format: items.push({name: "TabName", pageUrl: "...", gid: "123", initialSheet: ...})
  // We extract name and gid independently from each items.push() call
  const tabs: SheetTab[] = [];
  const pushRegex = /items\.push\(\{([^}]+)\}\)/g;
  let m: RegExpExecArray | null;
  while ((m = pushRegex.exec(html)) !== null) {
    const block = m[1];
    const nameMatch = block.match(/name\s*:\s*["']([^"']+)["']/);
    const gidMatch = block.match(/gid\s*:\s*["'](\d+)["']/);
    if (nameMatch && gidMatch) {
      tabs.push({ name: nameMatch[1], gid: gidMatch[1] });
    }
  }

  // Fallback: check for sheet-menu anchors
  if (tabs.length === 0) {
    const anchorRegex = /id="sheet-button-(\d+)"[^>]*>([^<]+)</g;
    while ((m = anchorRegex.exec(html)) !== null) {
      tabs.push({ name: m[2].trim(), gid: m[1] });
    }
  }

  return tabs;
}

export async function fetchSheetData(url: string): Promise<SheetResponse> {
  const csvUrl = toCSVUrl(url);
  console.log('Fetching CSV from:', csvUrl);

  const response = await fetch(csvUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();

  // Detect if Google returned an HTML page instead of CSV
  if (csvText.trimStart().startsWith('<!DOCTYPE') || csvText.trimStart().startsWith('<html')) {
    throw new Error(
      'Google returned an HTML page instead of CSV. Make sure the sheet is published to the web (File → Share → Publish to web → CSV).'
    );
  }

  if (!csvText.trim()) {
    throw new Error('Sheet returned empty content. Check that the URL is correct and the sheet has data.');
  }

  const result = Papa.parse<CardData>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors);
  }

  const headers = result.meta.fields ?? [];
  const rows = result.data;

  if (headers.length === 0) {
    throw new Error('No columns found. The sheet may be empty or not in CSV format.');
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
}
