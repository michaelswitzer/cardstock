import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { listTemplates, getTemplate, loadTemplateHTML, loadTemplateCSS, TEMPLATES_DIR } from '../services/templateEngine.js';

export const templatesRouter = Router();

/**
 * GET /api/templates
 * Returns list of available card templates.
 */
templatesRouter.get('/', async (_req, res, next) => {
  try {
    const templates = await listTemplates();
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/templates/:id
 * Returns a single template's manifest, HTML, and CSS.
 */
templatesRouter.get('/:id', async (req, res, next) => {
  try {
    const [template, html, css] = await Promise.all([
      getTemplate(req.params.id),
      loadTemplateHTML(req.params.id),
      loadTemplateCSS(req.params.id),
    ]);
    res.json({ template, html, css });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/templates
 * Create a new template directory with manifest, HTML, and CSS files.
 */
templatesRouter.post('/', async (req, res, next) => {
  try {
    const { id, manifest, html, css } = req.body as {
      id: string;
      manifest: string;
      html: string;
      css: string;
    };

    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      res.status(400).json({ error: 'ID must be a URL-safe slug (letters, numbers, hyphens, underscores)' });
      return;
    }

    const dir = path.join(TEMPLATES_DIR, id);

    // Check if directory already exists
    try {
      await fs.access(dir);
      res.status(409).json({ error: `Template "${id}" already exists` });
      return;
    } catch {
      // Directory doesn't exist — good
    }

    await fs.mkdir(dir, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(dir, 'manifest.json'), manifest, 'utf-8'),
      fs.writeFile(path.join(dir, 'template.html'), html, 'utf-8'),
      fs.writeFile(path.join(dir, 'template.css'), css, 'utf-8'),
    ]);

    const [template, savedHtml, savedCss] = await Promise.all([
      getTemplate(id),
      loadTemplateHTML(id),
      loadTemplateCSS(id),
    ]);
    res.status(201).json({ template, html: savedHtml, css: savedCss });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/templates/:id
 * Update an existing template's manifest, HTML, and CSS files.
 */
templatesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { manifest, html, css } = req.body as {
      manifest: string;
      html: string;
      css: string;
    };

    const dir = path.join(TEMPLATES_DIR, id);

    try {
      await fs.access(dir);
    } catch {
      res.status(404).json({ error: `Template "${id}" not found` });
      return;
    }

    await Promise.all([
      fs.writeFile(path.join(dir, 'manifest.json'), manifest, 'utf-8'),
      fs.writeFile(path.join(dir, 'template.html'), html, 'utf-8'),
      fs.writeFile(path.join(dir, 'template.css'), css, 'utf-8'),
    ]);

    const [template, savedHtml, savedCss] = await Promise.all([
      getTemplate(id),
      loadTemplateHTML(id),
      loadTemplateCSS(id),
    ]);
    res.json({ template, html: savedHtml, css: savedCss });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/templates/:id
 * Remove a template directory and all its files.
 */
templatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const dir = path.join(TEMPLATES_DIR, id);

    try {
      await fs.access(dir);
    } catch {
      res.status(404).json({ error: `Template "${id}" not found` });
      return;
    }

    await fs.rm(dir, { recursive: true });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
