// Package imaging replaces the sharp operations used by the old server:
// thumbnails, cover-resize for card backs, sprite-sheet compositing and PNG DPI metadata.
package imaging

import (
	"bytes"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"image"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"math"
	"os"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

var pngSig = []byte("\x89PNG\r\n\x1a\n")

// SetPNGDPI inserts (or replaces) a pHYs chunk so the PNG carries its print density.
func SetPNGDPI(data []byte, dpi int) ([]byte, error) {
	if len(data) < 33 || !bytes.Equal(data[:8], pngSig) {
		return nil, errors.New("not a PNG")
	}
	ppm := uint32(math.Round(float64(dpi) / 0.0254))
	chunk := make([]byte, 4+4+9+4)
	binary.BigEndian.PutUint32(chunk[0:], 9)
	copy(chunk[4:], "pHYs")
	binary.BigEndian.PutUint32(chunk[8:], ppm)
	binary.BigEndian.PutUint32(chunk[12:], ppm)
	chunk[16] = 1 // unit: metre
	binary.BigEndian.PutUint32(chunk[17:], crc32.ChecksumIEEE(chunk[4:17]))

	out := make([]byte, 0, len(data)+len(chunk))
	out = append(out, data[:8]...)
	pos := 8
	inserted := false
	for pos+8 <= len(data) {
		n := int(binary.BigEndian.Uint32(data[pos:]))
		typ := string(data[pos+4 : pos+8])
		end := pos + 12 + n
		if end > len(data) {
			return nil, errors.New("truncated PNG")
		}
		if typ != "pHYs" {
			out = append(out, data[pos:end]...)
		}
		if typ == "IHDR" && !inserted {
			out = append(out, chunk...)
			inserted = true
		}
		pos = end
	}
	return out, nil
}

func encodePNG(img image.Image, level png.CompressionLevel) ([]byte, error) {
	var buf bytes.Buffer
	enc := png.Encoder{CompressionLevel: level}
	if err := enc.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func decodeFile(path string) (image.Image, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	img, _, err := image.Decode(f)
	return img, err
}

// Thumbnail resizes an image to fit inside w×h (like sharp fit: 'inside') and returns PNG bytes.
// SVGs are not decodable here; callers should serve them as-is.
func Thumbnail(path string, w, h int) ([]byte, error) {
	src, err := decodeFile(path)
	if err != nil {
		return nil, err
	}
	b := src.Bounds()
	scale := math.Min(float64(w)/float64(b.Dx()), float64(h)/float64(b.Dy()))
	tw := max(1, int(math.Round(float64(b.Dx())*scale)))
	th := max(1, int(math.Round(float64(b.Dy())*scale)))
	dst := image.NewNRGBA(image.Rect(0, 0, tw, th))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Src, nil)
	return encodePNG(dst, png.DefaultCompression)
}

// CoverResize scales and center-crops an image to exactly w×h (sharp fit: 'cover'),
// returning a PNG tagged with dpi.
func CoverResize(path string, w, h, dpi int) ([]byte, error) {
	src, err := decodeFile(path)
	if err != nil {
		return nil, err
	}
	b := src.Bounds()
	scale := math.Max(float64(w)/float64(b.Dx()), float64(h)/float64(b.Dy()))
	cw, ch := float64(w)/scale, float64(h)/scale
	x0 := float64(b.Min.X) + (float64(b.Dx())-cw)/2
	y0 := float64(b.Min.Y) + (float64(b.Dy())-ch)/2
	crop := image.Rect(int(math.Round(x0)), int(math.Round(y0)), int(math.Round(x0+cw)), int(math.Round(y0+ch)))
	dst := image.NewNRGBA(image.Rect(0, 0, w, h))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, crop, draw.Src, nil)
	out, err := encodePNG(dst, png.DefaultCompression)
	if err != nil {
		return nil, err
	}
	return SetPNGDPI(out, dpi)
}

// SpriteSheet lays PNG cards out in a grid on a transparent canvas.
func SpriteSheet(cards [][]byte, cols, rows, cw, ch int) ([]byte, error) {
	sheet := image.NewNRGBA(image.Rect(0, 0, cols*cw, rows*ch))
	for i := 0; i < len(cards) && i < cols*rows; i++ {
		img, err := png.Decode(bytes.NewReader(cards[i]))
		if err != nil {
			return nil, err
		}
		at := image.Pt((i%cols)*cw, (i/cols)*ch)
		draw.Draw(sheet, image.Rectangle{at, at.Add(img.Bounds().Size())}, img, img.Bounds().Min, draw.Src)
	}
	return encodePNG(sheet, png.BestSpeed)
}
