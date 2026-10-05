package export

import "testing"

func TestLayoutGrid(t *testing.T) {
	// Poker cards on letter: 3x2 grid, centered (matches the old pdf-lib composer).
	g := layoutGrid(pdfOptions{PageSize: "letter", CardWidthInches: 2.5, CardHeightInches: 3.5})
	if g.Cols != 3 || g.Rows != 2 {
		t.Fatalf("grid = %dx%d, want 3x2", g.Cols, g.Rows)
	}
	if g.OffsetX != (612-3*180)/2.0 || g.OffsetY != (792-2*252)/2.0 {
		t.Errorf("offset = %v,%v", g.OffsetX, g.OffsetY)
	}
	// Tarot on A4: 2x2.
	g = layoutGrid(pdfOptions{PageSize: "a4", CardWidthInches: 2.75, CardHeightInches: 4.75})
	if g.Cols != 2 || g.Rows != 2 {
		t.Errorf("tarot grid = %dx%d, want 2x2", g.Cols, g.Rows)
	}
}
