package sheets

import (
	"reflect"
	"testing"
)

func TestParseCSV(t *testing.T) {
	d, err := ParseCSV("\xef\xbb\xbf Name ,Cost,Name\r\nGoblin,1,x\r\n\r\n\"Big, \"\"Ogre\"\"\",3\r\n")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(d.Headers, []string{"Name", "Cost", "Name_1"}) {
		t.Errorf("headers = %q", d.Headers)
	}
	if d.RowCount != 2 || d.Rows[1]["Name"] != `Big, "Ogre"` || d.Rows[1]["Cost"] != "3" {
		t.Errorf("rows = %v", d.Rows)
	}
	if _, ok := d.Rows[1]["Name_1"]; ok {
		t.Error("short row should not have a value for the missing column")
	}
}

func TestParseCSVRejectsHTML(t *testing.T) {
	if _, err := ParseCSV("<!DOCTYPE html><html>"); err == nil {
		t.Error("expected error for HTML response")
	}
}

func TestParseTabs(t *testing.T) {
	html := `var items = []; items.push({name: "Creatures", pageUrl: "x", gid: "0", initialSheet: true});` +
		`items.push({name: 'Spells', pageUrl: "y", gid: "123456"});`
	want := []Tab{{"Creatures", "0"}, {"Spells", "123456"}}
	if got := ParseTabs(html); !reflect.DeepEqual(got, want) {
		t.Errorf("ParseTabs = %v", got)
	}
	fallback := `<li id="sheet-button-42"><a href="#"> Lands </a></li>`
	if got := ParseTabs(`<div id="sheet-button-42" class="x"> Lands </div>`); !reflect.DeepEqual(got, []Tab{{"Lands", "42"}}) {
		t.Errorf("fallback = %v (%s)", got, fallback)
	}
}

func TestBuildTabCSVURL(t *testing.T) {
	got, _ := BuildTabCSVURL("https://docs.google.com/spreadsheets/d/e/2PACX-abc/pubhtml", "7")
	if got != "https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?output=csv&gid=7" {
		t.Error(got)
	}
	got, _ = BuildTabCSVURL("https://docs.google.com/spreadsheets/d/XYZ_1/edit#gid=0", "9")
	if got != "https://docs.google.com/spreadsheets/d/XYZ_1/export?format=csv&gid=9" {
		t.Error(got)
	}
}
