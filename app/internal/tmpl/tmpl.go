// Package tmpl loads card templates and hydrates them with sheet data
// (port of server/src/services/templateEngine.ts).
package tmpl

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"cardstock/internal/config"
)

// Template is manifest.json plus its folder id. Unknown manifest keys are preserved.
type Template map[string]any

func readManifest(id string) (Template, error) {
	raw, err := os.ReadFile(filepath.Join(config.TemplatesDir(), id, "manifest.json"))
	if err != nil {
		return nil, err
	}
	var t Template
	if err := json.Unmarshal(raw, &t); err != nil {
		return nil, err
	}
	t["id"] = id
	return t, nil
}

func List() ([]Template, error) {
	entries, err := os.ReadDir(config.TemplatesDir())
	if err != nil {
		return nil, err
	}
	out := []Template{}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if t, err := readManifest(e.Name()); err == nil {
			out = append(out, t)
		}
	}
	return out, nil
}

func Get(id string) (Template, error) { return readManifest(id) }

// Load returns the template's HTML and CSS, read from disk on every call.
func Load(id string) (html, css string, err error) {
	dir := filepath.Join(config.TemplatesDir(), id)
	h, err := os.ReadFile(filepath.Join(dir, "template.html"))
	if err != nil {
		return "", "", err
	}
	c, err := os.ReadFile(filepath.Join(dir, "template.css"))
	if err != nil {
		return "", "", err
	}
	return string(h), string(c), nil
}

var (
	fieldRe    = regexp.MustCompile(`\{\{(\w+)\}\}`)
	imageRe    = regexp.MustCompile(`\{\{image:(\w+)\}\}`)
	iconRe     = regexp.MustCompile(`\{icon:(\w+)\}`)
	templateRe = regexp.MustCompile(`\{\{template:([^}]+)\}\}`)
	boldRe     = regexp.MustCompile(`\*\*(.+?)\*\*`)
	italicRe   = regexp.MustCompile(`\*(.+?)\*`)
	strikeRe   = regexp.MustCompile(`~~(.+?)~~`)
	htmlEsc    = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&#039;")
)

// EncodeURIComponent matches JavaScript's encodeURIComponent.
func EncodeURIComponent(s string) string {
	var b strings.Builder
	for _, c := range []byte(s) {
		if c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || strings.IndexByte("-_.!~*'()", c) >= 0 {
			b.WriteByte(c)
		} else {
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}

func encodePath(p string) string {
	parts := strings.Split(p, "/")
	for i, s := range parts {
		parts[i] = EncodeURIComponent(s)
	}
	return strings.Join(parts, "/")
}

func submatch(re *regexp.Regexp, s string, fn func(string) string) string {
	return re.ReplaceAllStringFunc(s, func(m string) string { return fn(re.FindStringSubmatch(m)[1]) })
}

// Hydrate replaces placeholders with card data. Order matters and matches the TS version.
func Hydrate(html string, card, mapping map[string]string, artworkBaseURL, templateID string) string {
	result := submatch(fieldRe, html, func(field string) string {
		if col, ok := mapping[field]; ok && col != "" {
			if v, ok := card[col]; ok {
				return htmlEsc.Replace(v)
			}
		}
		return ""
	})
	result = submatch(imageRe, result, func(slot string) string {
		if col, ok := mapping[slot]; ok && col != "" && card[col] != "" {
			return artworkBaseURL + "/artwork/cardart/" + encodePath(card[col])
		}
		return ""
	})
	result = submatch(iconRe, result, func(name string) string {
		return `<img src="` + artworkBaseURL + "/artwork/icons/" + EncodeURIComponent(name) + `.png" class="inline-icon" />`
	})
	result = submatch(templateRe, result, func(file string) string {
		return fmt.Sprintf("http://127.0.0.1:%d/templates/%s/%s", config.Port(), EncodeURIComponent(templateID), encodePath(file))
	})
	return FormatText(result)
}

func FormatText(html string) string {
	html = boldRe.ReplaceAllString(html, "<strong>${1}</strong>")
	html = italicRe.ReplaceAllString(html, "<em>${1}</em>")
	return strikeRe.ReplaceAllString(html, "<s>${1}</s>")
}

// ArtworkURL is the base URL Chrome uses to load a game's images.
func ArtworkURL(slug string) string {
	if slug == "" {
		slug = "_none"
	}
	return fmt.Sprintf("http://127.0.0.1:%d/games/%s", config.Port(), slug)
}

// BuildCardPage builds a full HTML page for rendering a single card.
func BuildCardPage(templateID string, card, mapping map[string]string, artworkBaseURL string, widthCSS, heightCSS int) (string, error) {
	html, css, err := Load(templateID)
	if err != nil {
		return "", err
	}
	body := Hydrate(html, card, mapping, artworkBaseURL, templateID)
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
:root {
  --card-width: %dpx;
  --card-height: %dpx;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: transparent; }
.inline-icon { height: 1em; width: auto; vertical-align: middle; display: inline; }
%s
</style>
</head>
<body>
%s
</body>
</html>`, widthCSS, heightCSS, css, body), nil
}
