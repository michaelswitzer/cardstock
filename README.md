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

Open http://localhost:5173, click **Data Source** to connect a spreadsheet, then **Template** to pick a layout and map fields.

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
