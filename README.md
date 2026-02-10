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

## Choosing a Template and Mapping Fields

Click **Template** to open the template editor.

1. **Select a template** from the available layouts (e.g. "Standard Card")
2. **Map fields** -- Each template field (Title, Body Text, Cost, etc.) has a dropdown. Pick the spreadsheet column that should fill it. Image slots work the same way: point them to a column containing image filenames.
3. A **live preview** of the first card updates as you change mappings
4. Click **Done** when you're satisfied

Back on the main screen, all your cards will render with the mapped data.

### Artwork Images

If your template has image slots, place artwork files in the `artwork/` folder at the project root. Your spreadsheet column should contain the filename (e.g. `goblin.png`). Subfolders work too (e.g. `creatures/goblin.png`).

### Inline Icons

You can embed small icons directly in your card text using `{icon:name}` syntax. This works in any text field in your spreadsheet.

For example, if a card's body text in your spreadsheet reads:

```
Costs {icon:fire}{icon:fire} to play. Gains {icon:shield} on defense.
```

Cardstock will replace each `{icon:name}` with an inline image from `artwork/icons/name.png`, sized to match the surrounding text. To use this:

1. Add your icon images as PNGs to the `artwork/icons/` folder (e.g. `fire.png`, `shield.png`, `mana.png`)
2. Reference them in your spreadsheet cells with `{icon:filename}` (without the `.png` extension)

Icons render at the same height as the text they sit in and align to the baseline, so they flow naturally within sentences.

### Text Formatting

You can use markdown-style formatting in any text field in your spreadsheet:

- `**bold**` → **bold**
- `*italic*` → *italic*
- `~~strikethrough~~` → ~~strikethrough~~

Nesting works too: `**bold *and italic***` renders as expected. Formatting can be combined with inline icons: `{icon:fire} **costs 2** to play`.

## Saving Defaults

Click **Save Default** (visible in the Data Source and Template modals) to persist your current sheet URL, template choice, and field mappings. The next time you open Cardstock, it will automatically load your saved configuration and render your cards immediately -- no setup needed.

This is useful for the typical workflow: edit your spreadsheet, open Cardstock, and your cards are already there. Click **Refresh** to pull the latest data.

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

An `example` template is included in the repo as a starting point. To create your own, copy the `server/templates/example/` folder to a new name (e.g. `server/templates/my-game/`) and edit the three files. Your custom templates are gitignored by default so they won't be committed to the repo.

### Rendering

100 CSS px = 1 inch. Cards are 250x350 CSS px. Puppeteer renders at `deviceScaleFactor: 3`, producing 750x1050 px output at 300 DPI.

## Tech Stack

- **Client:** React 19, Vite, Zustand, TanStack React Query
- **Server:** Express, Puppeteer, sharp, pdf-lib, PapaParse
- **Shared:** TypeScript

## License

[MIT](LICENSE)
