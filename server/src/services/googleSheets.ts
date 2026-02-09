import Papa from 'papaparse';
import type { CardData, SheetResponse } from '@cardmaker/shared';

/**
 * Converts a Google Sheets sharing URL to its published CSV export URL.
 * Supports both /edit and /pub URLs.
 */
function toCSVUrl(url: string): string {
  // Extract spreadsheet ID
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

  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();

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

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
}
