// Package sheets fetches published Google Sheets as CSV and discovers tabs
// (port of server/src/services/googleSheets.ts).
package sheets

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type Tab struct {
	Name string `json:"name"`
	Gid  string `json:"gid"`
}

type Data struct {
	Headers  []string            `json:"headers"`
	Rows     []map[string]string `json:"rows"`
	RowCount int                 `json:"rowCount"`
}

var (
	client       = &http.Client{Timeout: 30 * time.Second}
	csvParamRe   = regexp.MustCompile(`(?i)[?&](format|output)=csv`)
	docIDRe      = regexp.MustCompile(`/d/([a-zA-Z0-9_-]+)`)
	publishedRe  = regexp.MustCompile(`/d/(e/[a-zA-Z0-9_-]+)`)
	gidRe        = regexp.MustCompile(`[#&?]gid=(\d+)`)
	pushRe       = regexp.MustCompile(`items\.push\(\{([^}]+)\}\)`)
	pushNameRe   = regexp.MustCompile(`name\s*:\s*["']([^"']+)["']`)
	pushGidRe    = regexp.MustCompile(`gid\s*:\s*["'](\d+)["']`)
	anchorRe     = regexp.MustCompile(`id="sheet-button-(\d+)"[^>]*>([^<]+)<`)
	errInvalidID = errors.New("Invalid Google Sheets URL. Could not extract spreadsheet ID.")
)

func toCSVURL(url string) (string, error) {
	if csvParamRe.MatchString(url) {
		return url, nil
	}
	m := docIDRe.FindStringSubmatch(url)
	if m == nil {
		return "", errInvalidID
	}
	gid := "0"
	if g := gidRe.FindStringSubmatch(url); g != nil {
		gid = g[1]
	}
	return fmt.Sprintf("https://docs.google.com/spreadsheets/d/%s/export?format=csv&gid=%s", m[1], gid), nil
}

// BuildTabCSVURL builds a CSV export URL for a specific tab of a sheet.
func BuildTabCSVURL(baseURL, gid string) (string, error) {
	if m := publishedRe.FindStringSubmatch(baseURL); m != nil {
		return fmt.Sprintf("https://docs.google.com/spreadsheets/d/%s/pub?output=csv&gid=%s", m[1], gid), nil
	}
	m := docIDRe.FindStringSubmatch(baseURL)
	if m == nil {
		return "", errInvalidID
	}
	return fmt.Sprintf("https://docs.google.com/spreadsheets/d/%s/export?format=csv&gid=%s", m[1], gid), nil
}

func get(url string) (string, error) {
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return "", fmt.Errorf("%d %s", resp.StatusCode, http.StatusText(resp.StatusCode))
	}
	b, err := io.ReadAll(resp.Body)
	return string(b), err
}

// DiscoverTabs fetches the pubhtml page and parses the embedded JS for tab names and gids.
func DiscoverTabs(url string) ([]Tab, error) {
	docPath := ""
	if m := publishedRe.FindStringSubmatch(url); m != nil {
		docPath = m[1]
	} else if m := docIDRe.FindStringSubmatch(url); m != nil {
		docPath = m[1]
	} else {
		return nil, errInvalidID
	}
	html, err := get(fmt.Sprintf("https://docs.google.com/spreadsheets/d/%s/pubhtml", docPath))
	if err != nil {
		return nil, fmt.Errorf("Failed to fetch pubhtml page: %w", err)
	}
	return ParseTabs(html), nil
}

func ParseTabs(html string) []Tab {
	tabs := []Tab{}
	for _, m := range pushRe.FindAllStringSubmatch(html, -1) {
		name := pushNameRe.FindStringSubmatch(m[1])
		gid := pushGidRe.FindStringSubmatch(m[1])
		if name != nil && gid != nil {
			tabs = append(tabs, Tab{name[1], gid[1]})
		}
	}
	if len(tabs) == 0 {
		for _, m := range anchorRe.FindAllStringSubmatch(html, -1) {
			tabs = append(tabs, Tab{strings.TrimSpace(m[2]), m[1]})
		}
	}
	return tabs
}

func FetchData(url string) (*Data, error) {
	csvURL, err := toCSVURL(url)
	if err != nil {
		return nil, err
	}
	log.Println("Fetching CSV from:", csvURL)
	text, err := get(csvURL)
	if err != nil {
		return nil, fmt.Errorf("Failed to fetch sheet: %w", err)
	}
	return ParseCSV(text)
}

// ParseCSV mirrors Papa.parse with {header: true, skipEmptyLines: true, transformHeader: trim}.
func ParseCSV(text string) (*Data, error) {
	trimmed := strings.TrimLeft(text, " \t\r\n")
	if strings.HasPrefix(trimmed, "<!DOCTYPE") || strings.HasPrefix(trimmed, "<html") {
		return nil, errors.New("Google returned an HTML page instead of CSV. Make sure the sheet is published to the web (File → Share → Publish to web → CSV).")
	}
	if strings.TrimSpace(text) == "" {
		return nil, errors.New("Sheet returned empty content. Check that the URL is correct and the sheet has data.")
	}
	r := csv.NewReader(strings.NewReader(strings.TrimPrefix(text, "\xef\xbb\xbf")))
	r.FieldsPerRecord = -1
	r.LazyQuotes = true
	records, err := r.ReadAll()
	if err != nil {
		log.Println("CSV parse warning:", err)
	}
	var headers []string
	rows := []map[string]string{}
	for _, rec := range records {
		if len(rec) == 1 && rec[0] == "" {
			continue // empty line
		}
		if headers == nil {
			headers = make([]string, len(rec))
			seen := map[string]int{}
			for i, h := range rec {
				h = strings.TrimSpace(h)
				// Papa renames duplicate headers to name_1, name_2, ...
				if n, dup := seen[h]; dup {
					seen[h] = n + 1
					h = fmt.Sprintf("%s_%d", h, n)
				} else {
					seen[h] = 1
				}
				headers[i] = h
			}
			continue
		}
		row := make(map[string]string, len(headers))
		for i, v := range rec {
			if i < len(headers) {
				row[headers[i]] = v
			}
		}
		rows = append(rows, row)
	}
	if len(headers) == 0 {
		return nil, errors.New("No columns found. The sheet may be empty or not in CSV format.")
	}
	return &Data{Headers: headers, Rows: rows, RowCount: len(rows)}, nil
}
