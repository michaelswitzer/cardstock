import Papa from 'papaparse';
import type { CardData, SheetResponse } from '@cardmaker/shared';

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
