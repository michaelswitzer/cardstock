import { Router } from 'express';
import { listTemplates, getTemplate, loadTemplateHTML, loadTemplateCSS } from '../services/templateEngine.js';

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
