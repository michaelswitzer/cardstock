package main

import "embed"

// webFS holds the built React client (copied from client/dist by `npm run build`).
//
//go:embed all:web/dist
var webFS embed.FS

// templatesFS holds the starter templates seeded into a new data folder.
//
//go:embed all:templates
var templatesFS embed.FS
