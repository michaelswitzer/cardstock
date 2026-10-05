// Package store persists games and decks as games/<slug>/game.json
// (port of server/src/services/dataStore.ts).
package store

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"cardstock/internal/config"
)

type StoredDeck struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	SheetTabGid      string            `json:"sheetTabGid"`
	SheetTabName     string            `json:"sheetTabName"`
	TemplateID       string            `json:"templateId"`
	Mapping          map[string]string `json:"mapping"`
	CardBackImage    string            `json:"cardBackImage,omitempty"`
	CardSizePreset   string            `json:"cardSizePreset,omitempty"`
	CardWidthInches  *float64          `json:"cardWidthInches,omitempty"`
	CardHeightInches *float64          `json:"cardHeightInches,omitempty"`
	Landscape        *bool             `json:"landscape,omitempty"`
	CreatedAt        string            `json:"createdAt"`
	UpdatedAt        string            `json:"updatedAt"`
}

type Deck struct {
	StoredDeck
	GameID string `json:"gameId"`
}

// MarshalJSON flattens the embedded StoredDeck and adds gameId.
func (d Deck) MarshalJSON() ([]byte, error) {
	b, err := json.Marshal(d.StoredDeck)
	if err != nil {
		return nil, err
	}
	gid, _ := json.Marshal(d.GameID)
	return append(append(b[:len(b)-1], []byte(`,"gameId":`)...), append(gid, '}')...), nil
}

type GameFile struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Slug        string       `json:"slug"`
	Description string       `json:"description,omitempty"`
	CoverImage  string       `json:"coverImage,omitempty"`
	SheetURL    string       `json:"sheetUrl"`
	CreatedAt   string       `json:"createdAt"`
	UpdatedAt   string       `json:"updatedAt"`
	Decks       []StoredDeck `json:"decks"`
}

type Game struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Slug        string `json:"slug"`
	Description string `json:"description,omitempty"`
	CoverImage  string `json:"coverImage,omitempty"`
	SheetURL    string `json:"sheetUrl"`
	DeckCount   int    `json:"deckCount"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

var (
	mu        sync.RWMutex
	gameIndex = map[string]string{} // gameId → slug
	deckIndex = map[string]string{} // deckId → gameId
	gameOrder []string              // gameIds in directory order (stable listing)
)

func NewUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func now() string { return time.Now().UTC().Format("2006-01-02T15:04:05.000Z") }

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(title string) string {
	s := strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(title), "-"), "-")
	if s == "" {
		return "game"
	}
	return s
}

func uniqueSlug(base string, existing map[string]bool) string {
	if !existing[base] {
		return base
	}
	n := 2
	for existing[base+"-"+strconv.Itoa(n)] {
		n++
	}
	return base + "-" + strconv.Itoa(n)
}

func readGameFile(slug string) (*GameFile, error) {
	raw, err := os.ReadFile(filepath.Join(config.GamesDir(), slug, "game.json"))
	if err != nil {
		return nil, err
	}
	var gf GameFile
	if err := json.Unmarshal(raw, &gf); err != nil {
		return nil, err
	}
	if gf.Decks == nil {
		gf.Decks = []StoredDeck{}
	}
	return &gf, nil
}

func writeGameFile(slug string, gf *GameFile) error {
	b, err := json.MarshalIndent(gf, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(config.GamesDir(), slug, "game.json"), b, 0o644)
}

func toGame(gf *GameFile) Game {
	return Game{gf.ID, gf.Title, gf.Slug, gf.Description, gf.CoverImage, gf.SheetURL, len(gf.Decks), gf.CreatedAt, gf.UpdatedAt}
}

func toDeck(sd StoredDeck, gameID string) Deck {
	if sd.Mapping == nil {
		sd.Mapping = map[string]string{}
	}
	return Deck{sd, gameID}
}

func makeGameDirs(slug string) error {
	for _, sub := range []string{"cardart", "cardback", "icons"} {
		if err := os.MkdirAll(filepath.Join(config.GamesDir(), slug, "artwork", sub), 0o755); err != nil {
			return err
		}
	}
	return nil
}

// InitIndex scans games/ and rebuilds the in-memory indexes.
func InitIndex() {
	mu.Lock()
	defer mu.Unlock()
	gameIndex = map[string]string{}
	deckIndex = map[string]string{}
	gameOrder = nil
	entries, err := os.ReadDir(config.GamesDir())
	if err != nil {
		return
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		gf, err := readGameFile(e.Name())
		if err != nil {
			continue
		}
		gameIndex[gf.ID] = e.Name()
		gameOrder = append(gameOrder, gf.ID)
		for _, d := range gf.Decks {
			deckIndex[d.ID] = gf.ID
		}
	}
}

func GameSlug(gameID string) (string, bool) {
	mu.RLock()
	defer mu.RUnlock()
	s, ok := gameIndex[gameID]
	return s, ok
}

// GameDir returns the absolute folder for a game, or "" if unknown.
func GameDir(gameID string) string {
	slug, ok := GameSlug(gameID)
	if !ok {
		return ""
	}
	return filepath.Join(config.GamesDir(), slug)
}

func ListGames() []Game {
	mu.RLock()
	ids := append([]string(nil), gameOrder...)
	slugs := make([]string, len(ids))
	for i, id := range ids {
		slugs[i] = gameIndex[id]
	}
	mu.RUnlock()
	games := []Game{}
	for _, slug := range slugs {
		if gf, err := readGameFile(slug); err == nil {
			games = append(games, toGame(gf))
		}
	}
	return games
}

func GetGame(id string) (*Game, bool) {
	slug, ok := GameSlug(id)
	if !ok {
		return nil, false
	}
	gf, err := readGameFile(slug)
	if err != nil {
		return nil, false
	}
	g := toGame(gf)
	return &g, true
}

func CreateGame(title, description, sheetURL string) (Game, error) {
	mu.Lock()
	defer mu.Unlock()
	existing := map[string]bool{}
	for _, s := range gameIndex {
		existing[s] = true
	}
	slug := uniqueSlug(slugify(title), existing)
	t := now()
	gf := &GameFile{ID: NewUUID(), Title: title, Slug: slug, Description: description, SheetURL: sheetURL, CreatedAt: t, UpdatedAt: t, Decks: []StoredDeck{}}
	if err := makeGameDirs(slug); err != nil {
		return Game{}, err
	}
	if err := writeGameFile(slug, gf); err != nil {
		return Game{}, err
	}
	gameIndex[gf.ID] = slug
	gameOrder = append(gameOrder, gf.ID)
	return toGame(gf), nil
}

// GameUpdate fields are nil when absent from the request.
type GameUpdate struct {
	Title, Description, CoverImage, SheetURL *string
}

func UpdateGame(id string, u GameUpdate) (*Game, error) {
	mu.Lock()
	defer mu.Unlock()
	slug, ok := gameIndex[id]
	if !ok {
		return nil, nil
	}
	gf, err := readGameFile(slug)
	if err != nil {
		return nil, err
	}
	if u.Title != nil {
		gf.Title = *u.Title
	}
	if u.Description != nil {
		gf.Description = *u.Description
	}
	if u.CoverImage != nil {
		gf.CoverImage = *u.CoverImage
	}
	if u.SheetURL != nil {
		gf.SheetURL = *u.SheetURL
	}
	gf.UpdatedAt = now()
	if err := writeGameFile(slug, gf); err != nil {
		return nil, err
	}
	g := toGame(gf)
	return &g, nil
}

func DeleteGame(id string) (bool, error) {
	mu.Lock()
	defer mu.Unlock()
	slug, ok := gameIndex[id]
	if !ok {
		return false, nil
	}
	if gf, err := readGameFile(slug); err == nil {
		for _, d := range gf.Decks {
			delete(deckIndex, d.ID)
		}
	}
	if err := os.RemoveAll(filepath.Join(config.GamesDir(), slug)); err != nil {
		return false, err
	}
	delete(gameIndex, id)
	for i, gid := range gameOrder {
		if gid == id {
			gameOrder = append(gameOrder[:i], gameOrder[i+1:]...)
			break
		}
	}
	return true, nil
}

func ListDecks(gameID string) []Deck {
	decks := []Deck{}
	slug, ok := GameSlug(gameID)
	if !ok {
		return decks
	}
	gf, err := readGameFile(slug)
	if err != nil {
		return decks
	}
	for _, sd := range gf.Decks {
		decks = append(decks, toDeck(sd, gameID))
	}
	return decks
}

func CreateDeck(gameID string, sd StoredDeck) (*Deck, error) {
	mu.Lock()
	defer mu.Unlock()
	slug, ok := gameIndex[gameID]
	if !ok {
		return nil, nil
	}
	gf, err := readGameFile(slug)
	if err != nil {
		return nil, err
	}
	t := now()
	sd.ID, sd.CreatedAt, sd.UpdatedAt = NewUUID(), t, t
	if sd.Mapping == nil {
		sd.Mapping = map[string]string{}
	}
	gf.Decks = append(gf.Decks, sd)
	gf.UpdatedAt = t
	if err := writeGameFile(slug, gf); err != nil {
		return nil, err
	}
	deckIndex[sd.ID] = gameID
	d := toDeck(sd, gameID)
	return &d, nil
}

func GetDeck(id string) (*Deck, error) {
	mu.RLock()
	gameID, ok := deckIndex[id]
	slug, ok2 := gameIndex[gameID]
	mu.RUnlock()
	if !ok || !ok2 {
		return nil, nil
	}
	gf, err := readGameFile(slug)
	if err != nil {
		return nil, err
	}
	for _, sd := range gf.Decks {
		if sd.ID == id {
			d := toDeck(sd, gameID)
			return &d, nil
		}
	}
	return nil, nil
}

// UpdateDeck applies the JSON fields present in body (same semantics as dataStore.updateDeck:
// empty/null values clear optional fields).
func UpdateDeck(id string, body map[string]json.RawMessage) (*Deck, error) {
	mu.Lock()
	defer mu.Unlock()
	gameID, ok := deckIndex[id]
	slug, ok2 := gameIndex[gameID]
	if !ok || !ok2 {
		return nil, nil
	}
	gf, err := readGameFile(slug)
	if err != nil {
		return nil, err
	}
	var sd *StoredDeck
	for i := range gf.Decks {
		if gf.Decks[i].ID == id {
			sd = &gf.Decks[i]
		}
	}
	if sd == nil {
		return nil, nil
	}
	setStr := func(key string, dst *string) {
		if raw, ok := body[key]; ok {
			var s *string
			if json.Unmarshal(raw, &s) == nil {
				if s == nil {
					*dst = ""
				} else {
					*dst = *s
				}
			}
		}
	}
	setNum := func(key string, dst **float64) {
		if raw, ok := body[key]; ok {
			var f *float64
			if json.Unmarshal(raw, &f) == nil && f != nil && *f != 0 {
				*dst = f
			} else {
				*dst = nil
			}
		}
	}
	setStr("name", &sd.Name)
	setStr("sheetTabGid", &sd.SheetTabGid)
	setStr("sheetTabName", &sd.SheetTabName)
	setStr("templateId", &sd.TemplateID)
	if raw, ok := body["mapping"]; ok {
		var m map[string]string
		if json.Unmarshal(raw, &m) == nil && m != nil {
			sd.Mapping = m
		}
	}
	setStr("cardBackImage", &sd.CardBackImage)
	setStr("cardSizePreset", &sd.CardSizePreset)
	setNum("cardWidthInches", &sd.CardWidthInches)
	setNum("cardHeightInches", &sd.CardHeightInches)
	if raw, ok := body["landscape"]; ok {
		var b *bool
		_ = json.Unmarshal(raw, &b)
		sd.Landscape = b
	}
	sd.UpdatedAt = now()
	gf.UpdatedAt = sd.UpdatedAt
	if err := writeGameFile(slug, gf); err != nil {
		return nil, err
	}
	d := toDeck(*sd, gameID)
	return &d, nil
}

func DeleteDeck(id string) (bool, error) {
	mu.Lock()
	defer mu.Unlock()
	gameID, ok := deckIndex[id]
	slug, ok2 := gameIndex[gameID]
	if !ok || !ok2 {
		return false, nil
	}
	gf, err := readGameFile(slug)
	if err != nil {
		return false, err
	}
	idx := -1
	for i, d := range gf.Decks {
		if d.ID == id {
			idx = i
		}
	}
	if idx == -1 {
		return false, nil
	}
	gf.Decks = append(gf.Decks[:idx], gf.Decks[idx+1:]...)
	gf.UpdatedAt = now()
	if err := writeGameFile(slug, gf); err != nil {
		return false, err
	}
	delete(deckIndex, id)
	return true, nil
}

// --- Legacy migration (.cardmaker-defaults.json → .cardmaker-data.json → per-game folders) ---

type legacyData struct {
	Version int `json:"version"`
	Games   []struct {
		ID          string   `json:"id"`
		Title       string   `json:"title"`
		Description string   `json:"description,omitempty"`
		CoverImage  string   `json:"coverImage,omitempty"`
		SheetURL    string   `json:"sheetUrl"`
		DeckIDs     []string `json:"deckIds"`
		CreatedAt   string   `json:"createdAt"`
		UpdatedAt   string   `json:"updatedAt"`
	} `json:"games"`
	Decks []Deck `json:"decks"`
}

func (d *Deck) UnmarshalJSON(b []byte) error {
	if err := json.Unmarshal(b, &d.StoredDeck); err != nil {
		return err
	}
	var g struct {
		GameID string `json:"gameId"`
	}
	_ = json.Unmarshal(b, &g)
	d.GameID = g.GameID
	return nil
}

// Migrate converts legacy central data files, then builds the index.
func Migrate() error {
	root := config.Root()
	dataPath := filepath.Join(root, ".cardmaker-data.json")
	oldDefaults := filepath.Join(root, ".cardmaker-defaults.json")
	defer InitIndex()

	if _, err := os.Stat(dataPath); errors.Is(err, os.ErrNotExist) {
		var od struct {
			SheetURL          string                       `json:"sheetUrl"`
			DefaultTemplateID string                       `json:"defaultTemplateId"`
			Mappings          map[string]map[string]string `json:"mappings"`
		}
		if raw, err := os.ReadFile(oldDefaults); err == nil && json.Unmarshal(raw, &od) == nil &&
			od.SheetURL != "" && od.DefaultTemplateID != "" {
			t := now()
			gameID, deckID := NewUUID(), NewUUID()
			mapping := od.Mappings[od.DefaultTemplateID]
			if mapping == nil {
				mapping = map[string]string{}
			}
			central := map[string]any{
				"version": 1,
				"games": []map[string]any{{
					"id": gameID, "title": "Migrated Game", "sheetUrl": od.SheetURL,
					"deckIds": []string{deckID}, "createdAt": t, "updatedAt": t,
				}},
				"decks": []map[string]any{{
					"id": deckID, "gameId": gameID, "name": "Migrated Deck", "sheetTabGid": "0",
					"sheetTabName": "Sheet1", "templateId": od.DefaultTemplateID, "mapping": mapping,
					"createdAt": t, "updatedAt": t,
				}},
			}
			b, _ := json.MarshalIndent(central, "", "  ")
			if err := os.WriteFile(dataPath, b, 0o644); err != nil {
				return err
			}
			if err := os.Rename(oldDefaults, oldDefaults+".bak"); err != nil {
				return err
			}
		}
	}

	raw, err := os.ReadFile(dataPath)
	if err != nil {
		return nil
	}
	var central legacyData
	if err := json.Unmarshal(raw, &central); err != nil || len(central.Games) == 0 {
		return nil
	}
	existing := map[string]bool{}
	if entries, err := os.ReadDir(config.GamesDir()); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				existing[e.Name()] = true
			}
		}
	}
	for _, og := range central.Games {
		slug := uniqueSlug(slugify(og.Title), existing)
		existing[slug] = true
		decks := []StoredDeck{}
		for _, d := range central.Decks {
			for _, id := range og.DeckIDs {
				if d.ID == id {
					sd := d.StoredDeck
					sd.CardSizePreset, sd.CardWidthInches, sd.CardHeightInches, sd.Landscape = "", nil, nil, nil
					decks = append(decks, sd)
				}
			}
		}
		gf := &GameFile{og.ID, og.Title, slug, og.Description, og.CoverImage, og.SheetURL, og.CreatedAt, og.UpdatedAt, decks}
		if err := makeGameDirs(slug); err != nil {
			return err
		}
		if err := writeGameFile(slug, gf); err != nil {
			return err
		}
	}
	return os.Rename(dataPath, dataPath+".bak")
}
