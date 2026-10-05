package tmpl

import (
	"testing"

	"cardstock/internal/config"
)

func TestHydrate(t *testing.T) {
	config.SetPort(3001)
	card := map[string]string{"Name": `Fire & "Ice"`, "Art": "sub dir/C001.png", "Text": "Deal **2** *fire* ~~cold~~ {icon:flame}"}
	mapping := map[string]string{"title": "Name", "art": "Art", "body": "Text", "unset": ""}
	html := `<h1>{{title}}</h1><img src="{{image:art}}"><p>{{body}}</p>{{unset}}{{missing}}<i>{{template:img/border 1.png}}</i>`
	got := Hydrate(html, card, mapping, "http://127.0.0.1:3001/games/g", "ex ample")
	want := `<h1>Fire &amp; &quot;Ice&quot;</h1><img src="http://127.0.0.1:3001/games/g/artwork/cardart/sub%20dir/C001.png">` +
		`<p>Deal <strong>2</strong> <em>fire</em> <s>cold</s> <img src="http://127.0.0.1:3001/games/g/artwork/icons/flame.png" class="inline-icon" /></p>` +
		`<i>http://127.0.0.1:3001/templates/ex%20ample/img/border%201.png</i>`
	if got != want {
		t.Errorf("Hydrate mismatch\n got: %s\nwant: %s", got, want)
	}
}

func TestEncodeURIComponent(t *testing.T) {
	cases := map[string]string{"a b": "a%20b", "x&y=z": "x%26y%3Dz", "it's(1)!*~": "it's(1)!*~", "é": "%C3%A9"}
	for in, want := range cases {
		if got := EncodeURIComponent(in); got != want {
			t.Errorf("EncodeURIComponent(%q) = %q, want %q", in, got, want)
		}
	}
}
