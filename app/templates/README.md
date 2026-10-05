# Template Authoring Guide

## File Structure

Each template lives in its own folder under `server/templates/<id>/`:

```
server/templates/
└── my-template/
    ├── manifest.json    # Metadata: name, description, fields, image slots
    ├── template.html    # Card body HTML with placeholder syntax
    └── template.css     # Styling (injected into rendered page)
```

## CSS Custom Properties

The renderer injects `:root` CSS custom properties for the deck's configured card size:

| Variable         | Description                          |
|------------------|--------------------------------------|
| `--card-width`   | Card width in CSS px (100px = 1 in)  |
| `--card-height`  | Card height in CSS px (100px = 1 in) |

Use these with fallbacks for backward compatibility:

```css
.card {
  width: var(--card-width, 250px);
  height: var(--card-height, 350px);
}
```

**Best practice:** Always use `var(--card-width)` and `var(--card-height)` for the card container dimensions so templates adapt to poker, bridge, tarot, or custom card sizes.

## Placeholder Syntax

| Syntax              | Description                                   |
|---------------------|-----------------------------------------------|
| `{{fieldName}}`     | Text field — replaced with mapped sheet value  |
| `{{image:slotName}}`| Image slot — replaced with artwork URL         |
| `{icon:name}`       | Icon — replaced with `<img>` from icons folder |

## Markdown Formatting

Template text supports inline markdown:

- `**bold**` → **bold**
- `*italic*` → *italic*
- `~~strikethrough~~` → ~~strikethrough~~

## manifest.json

```json
{
  "name": "My Template",
  "description": "Description of the template.",
  "fields": [
    { "name": "title", "label": "Title", "type": "text" },
    { "name": "body", "label": "Body Text", "type": "textarea" }
  ],
  "imageSlots": [
    { "name": "artwork", "label": "Card Artwork", "width": 230, "height": 170 }
  ]
}
```

- `fields`: Text placeholders available in the template
- `imageSlots`: Image placeholders with reference dimensions
