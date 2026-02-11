/**
 * Builds a CSV export URL for a specific tab (by gid) of a Google Sheet.
 * Published URLs (/d/e/LONG_ID/...) use /pub?output=csv&gid=
 * Edit URLs (/d/SPREADSHEET_ID/...) use /export?format=csv&gid=
 */
export function buildTabCsvUrl(baseUrl: string, gid: string): string {
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
