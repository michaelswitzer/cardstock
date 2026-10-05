# Cardstock

A card-rendering tool for game designers. Connect a Google Sheets spreadsheet, pick a template, map fields, and instantly preview and export your cards.

## Features

- **Google Sheets integration** -- Fetch card data from any published Google Sheet
- **Template system** -- HTML/CSS templates with `{{field}}` and `{{image:slot}}` placeholders
- **Live preview** -- See all your cards rendered in real time as you adjust mappings
- **Refresh workflow** -- Update your spreadsheet, hit Refresh, and see changes instantly
- **Export formats** -- Individual PNGs (300 DPI), print-ready PDF with crop marks, or Tabletop Simulator sprite sheets
- **Saved defaults** -- Remembers your sheet URL, template, and field mappings between sessions

## Download & Run

Grab the archive for your system from the [Releases](https://github.com/michaelswitzer/cardstock/releases) page. There is no installer: unzip it and run the app.

| System | Archive | Run |
|---|---|---|
| Windows 10/11 | `Cardstock-<version>-windows-x64.zip` | `Cardstock/Cardstock.exe` |
| macOS (Apple Silicon / Intel) | `Cardstock-<version>-macos-arm64.zip` / `-macos-x64.zip` | `Cardstock/Cardstock.app` |
| Linux | `Cardstock-<version>-linux-x64.tar.gz` / `-linux-arm64.tar.gz` | `Cardstock/cardstock` |

Cardstock opens in its own window. It shuts down by itself a few seconds after you close that window.

**Your data** (games, templates, exports) is stored next to the app, in the folder you unzipped it to. If that folder isn't writable, or the Mac app is in `/Applications`, data goes to `Documents/Cardstock` instead. **Change Data Folder** on the Games page moves it anywhere you like.

**Browser requirement:** cards are rendered with a Chromium-based browser engine: Microsoft Edge (built into Windows), Google Chrome, Chromium, Brave or Vivaldi. If none is installed, Cardstock downloads a headless Chrome on first launch (about 260 MB unpacked, one time) into a `renderer/` folder next to the app. A banner shows the progress, then confirms where it was saved. Delete that folder to remove it. The app window opens in your installed Chromium browser if there is one, or otherwise in your default browser. Firefox works fine for the UI.

**First launch on macOS:** the app isn't signed with an Apple Developer ID, so macOS blocks it the first time. Right-click `Cardstock.app` → **Open** → **Open**, or run `xattr -dr com.apple.quarantine Cardstock.app`.

**First launch on Windows:** SmartScreen may warn about an unrecognized app. Click **More info** → **Run anyway**.

**NixOS:** Google's prebuilt Chrome can't run there, so if no Chromium is installed Cardstock fetches `chromium` from nixpkgs instead (via `nix build`) and links it into `renderer/chromium`. Delete that link and run `nix-collect-garbage` to remove it.

Command-line options: `--data <folder>`, `--chrome <browser path>`, `--ui auto|app|browser|none`, `--port <n>`, `--version`.

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

### Card Back Images

Card back images go in `artwork/cardback/` at the project root. When creating or editing a deck, the card back dropdown lists all images from this folder. The card back is shown as the first card in the deck view and exported as a separate file alongside your cards.

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
app/        Go program: HTTP API, headless-browser rendering, exports, launcher (embeds the client)
  templates/  Starter templates copied into new data folders
  tools/release/  Cross-platform release packaging
client/     React + Vite single-page UI
shared/     TypeScript types and constants used by the client
```

### Templates

Templates live in `<data folder>/templates/<id>/` with three files:

- `manifest.json` -- Declares fields, image slots, and card dimensions
- `template.html` -- Card layout with `{{fieldName}}` and `{{image:slotName}}` placeholders
- `template.css` -- Card styling

An `example` template is created in every new data folder as a starting point. To make your own, copy the `example` folder to a new name (e.g. `templates/my-game/`) and edit the three files, or create one from the **Card Templates** page.

#### Template Assets

Template folders can also contain image files for static layout elements like borders, backgrounds, and textures. These are part of the template design itself — distinct from per-card artwork that comes from your spreadsheet.

There are two ways to reference template assets:

- **In CSS:** Use `url(/templates/<id>/border.png)` in your `template.css`
- **In HTML:** Use the `{{template:border.png}}` placeholder in your `template.html`

### Rendering

100 CSS px = 1 inch. Cards are 250x350 CSS px, rendered by headless Chromium at device scale factor 3, producing 750x1050 px output at 300 DPI.

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ (builds the client)
- [Go](https://go.dev/dl/) 1.26+ (builds the app)
- A Chromium-based browser for rendering

### Development

```bash
npm install
```

Start the server and client in separate terminals:

```bash
cd app && go run . --data ../devdata --port 3001 --ui=none --no-exit   # API on port 3001
cd client && npx vite                                                  # Dev server on port 5173
```

Open http://localhost:5173.

### Building the App

```bash
npm run app       # builds app/cardstock (or cardstock.exe) for this machine
npm run release   # builds archives for Windows, macOS and Linux into app/dist/
npm test          # Go unit tests
```

Go cross-compiles, so one machine can build every platform's archive. Publishing a GitHub release runs the same build in CI and attaches the archives.

## Tech Stack

- **Client:** React 19, Vite, Zustand, TanStack React Query
- **App:** Go (net/http, chromedp, gopdf, golang.org/x/image)
- **Shared:** TypeScript

## License

[MIT](LICENSE)
