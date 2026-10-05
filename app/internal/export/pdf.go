package export

import (
	"bytes"

	"github.com/signintech/gopdf"

	"cardstock/internal/config"
)

type pdfOptions struct {
	PageSize                         string
	CropMarks                        bool
	CardWidthInches, CardHeightInches float64
}

type gridLayout struct {
	Cols, Rows       int
	CardW, CardH     float64
	OffsetX, OffsetY float64
	Page             config.PageSize
}

// layoutGrid computes how many cards fit per page and centers the grid
// (same math as pdfComposer.ts, but with a top-left origin).
func layoutGrid(opts pdfOptions) gridLayout {
	ps, ok := config.PDFPageSizes[opts.PageSize]
	if !ok {
		ps = config.PDFPageSizes["letter"]
	}
	cw, ch := opts.CardWidthInches*72, opts.CardHeightInches*72
	cols := int((ps.Width - 2*config.PDFMargin) / cw)
	rows := int((ps.Height - 2*config.PDFMargin) / ch)
	return gridLayout{
		Cols: cols, Rows: rows, CardW: cw, CardH: ch,
		OffsetX: (ps.Width - float64(cols)*cw) / 2,
		OffsetY: (ps.Height - float64(rows)*ch) / 2,
		Page:    ps,
	}
}

// composePDF places card PNGs onto print-ready pages, optionally with crop marks.
func composePDF(cards [][]byte, opts pdfOptions) ([]byte, error) {
	g := layoutGrid(opts)
	perPage := g.Cols * g.Rows
	if perPage < 1 {
		perPage = 1
		g.Cols, g.Rows = 1, 1
	}
	pdf := &gopdf.GoPdf{}
	pdf.Start(gopdf.Config{PageSize: gopdf.Rect{W: g.Page.Width, H: g.Page.Height}, Unit: gopdf.UnitPT})
	pdf.SetLineWidth(0.5)
	pdf.SetStrokeColor(0, 0, 0)
	for i := 0; i < len(cards); i += perPage {
		pdf.AddPage()
		for j := 0; j < perPage && i+j < len(cards); j++ {
			x := g.OffsetX + float64(j%g.Cols)*g.CardW
			y := g.OffsetY + float64(j/g.Cols)*g.CardH
			holder, err := gopdf.ImageHolderByBytes(cards[i+j])
			if err != nil {
				return nil, err
			}
			if err := pdf.ImageByHolder(holder, x, y, &gopdf.Rect{W: g.CardW, H: g.CardH}); err != nil {
				return nil, err
			}
			if opts.CropMarks {
				drawCropMarks(pdf, x, y, g.CardW, g.CardH)
			}
		}
	}
	var buf bytes.Buffer
	if _, err := pdf.WriteTo(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// drawCropMarks draws marks pointing outward from each corner, offset 2pt from the card edge.
func drawCropMarks(pdf *gopdf.GoPdf, x, y, w, h float64) {
	l := config.CropMarkLength
	for _, c := range [][2]float64{{x, y}, {x + w, y}, {x, y + h}, {x + w, y + h}} {
		cx, cy := c[0], c[1]
		hDir, vDir := 1.0, 1.0
		if cx == x {
			hDir = -1
		}
		if cy == y {
			vDir = -1 // top edge: marks extend upward
		}
		pdf.Line(cx+hDir*2, cy, cx+hDir*(2+l), cy)
		pdf.Line(cx, cy+vDir*2, cx, cy+vDir*(2+l))
	}
}
