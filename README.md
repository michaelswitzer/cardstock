# Cardstock

A card-rendering tool for game designers. Connect a Google Sheets spreadsheet, pick a template, map fields, and instantly preview and export your cards.

## Features

- **Google Sheets integration** -- Fetch card data from any published Google Sheet
- **Template system** -- HTML/CSS templates with `{{field}}` and `{{image:slot}}` placeholders
- **Live preview** -- See all your cards rendered in real time as you adjust mappings
- **Refresh workflow** -- Update your spreadsheet, hit Refresh, and see changes instantly
- **Export formats** -- Individual PNGs (300 DPI), print-ready PDF with crop marks, or Tabletop Simulator sprite sheets
- **Saved defaults** -- Remembers your sheet URL, template, and field mappings between sessions

## Quick Start

```bash
npm install
```

Start the server and client in separate terminals:

```bash
cd server && npx tsx src/index.ts    # API server on port 3001
cd client && npx vite                # Dev server on port 5173
```

Open http://localhost:5173.

## Connecting a Google Sheet

Your card data lives in a Google Sheets spreadsheet. Each row is a card and each column is a field (e.g. Name, Cost, Description, Image).

1. Open your spreadsheet in Google Sheets
2. Go to **File > Share > Publish to web**
3. In the dialog, select **Entire Document** and **Web page**, then click **Publish**
4. Copy the URL that appears (it looks like `https://docs.google.com/spreadsheets/d/e/.../pubhtml`)
5. In Cardstock, click **Data Source**, paste the URL, and click **Fetch Data**

Once your data is loaded, click **Continue to Template** (or close and click **Template**) to select a card layout and map your spreadsheet columns to template fields.

## Project Structure

```
shared/     Types and constants shared between server and client
server/     Express API, Puppeteer rendering, export services
client/     React + Vite single-page UI
artwork/    Card artwork images (gitignored, served at /artwork)
output/     Exported files (gitignored, served at /output)
```

### Templates

Templates live in `server/templates/<id>/` with three files:

- `manifest.json` -- Declares fields, image slots, and card dimensions
- `template.html` -- Card layout with `{{fieldName}}` and `{{image:slotName}}` placeholders
- `template.css` -- Card styling

### Rendering

100 CSS px = 1 inch. Cards are 250x350 CSS px. Puppeteer renders at `deviceScaleFactor: 3`, producing 750x1050 px output at 300 DPI.

## Tech Stack

- **Client:** React 19, Vite, Zustand, TanStack React Query
- **Server:** Express, Puppeteer, sharp, pdf-lib, PapaParse
- **Shared:** TypeScript

## License

[MIT](LICENSE)
