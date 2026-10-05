package imaging

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/png"
	"testing"
)

func TestSetPNGDPI(t *testing.T) {
	var buf bytes.Buffer
	png.Encode(&buf, image.NewNRGBA(image.Rect(0, 0, 4, 3)))
	out, err := SetPNGDPI(buf.Bytes(), 300)
	if err != nil {
		t.Fatal(err)
	}
	// Applying twice must not duplicate the chunk.
	if out, err = SetPNGDPI(out, 300); err != nil {
		t.Fatal(err)
	}
	if n := bytes.Count(out, []byte("pHYs")); n != 1 {
		t.Fatalf("want 1 pHYs chunk, got %d", n)
	}
	i := bytes.Index(out, []byte("pHYs"))
	if ppm := binary.BigEndian.Uint32(out[i+4:]); ppm != 11811 {
		t.Errorf("ppm = %d, want 11811", ppm)
	}
	if bytes.Index(out, []byte("IHDR")) > i {
		t.Error("pHYs must follow IHDR")
	}
	img, err := png.Decode(bytes.NewReader(out))
	if err != nil || img.Bounds().Dx() != 4 {
		t.Fatalf("decode after insert failed: %v", err)
	}
}

func TestSpriteSheet(t *testing.T) {
	var buf bytes.Buffer
	png.Encode(&buf, image.NewNRGBA(image.Rect(0, 0, 10, 14)))
	cards := [][]byte{buf.Bytes(), buf.Bytes(), buf.Bytes()}
	out, err := SpriteSheet(cards, 2, 2, 10, 14)
	if err != nil {
		t.Fatal(err)
	}
	cfg, _ := png.DecodeConfig(bytes.NewReader(out))
	if cfg.Width != 20 || cfg.Height != 28 {
		t.Errorf("sheet is %dx%d, want 20x28", cfg.Width, cfg.Height)
	}
}
