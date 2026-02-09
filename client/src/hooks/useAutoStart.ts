import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { fetchDefaults, fetchSheetData, fetchTemplates } from '../api/client';

/**
 * On app load, checks for saved defaults. If a complete config exists
 * (sheetUrl + templateId + mapping), fetches data, sets up the store,
 * and navigates directly to the preview page.
 *
 * Uses a ref to ensure only one attempt runs (StrictMode fires effects twice).
 */
export function useAutoStart() {
  const [loading, setLoading] = useState(true);
  const started = useRef(false);
  const navigate = useNavigate();
  const { setSheetUrl, setSheetData, setTemplate, setMapping } = useAppStore();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function run() {
      try {
        const defaults = await fetchDefaults();

        if (
          !defaults.sheetUrl ||
          !defaults.defaultTemplateId ||
          !defaults.mappings?.[defaults.defaultTemplateId]
        ) {
          setLoading(false);
          return;
        }

        const [sheetData, templateData] = await Promise.all([
          fetchSheetData(defaults.sheetUrl),
          fetchTemplates(),
        ]);

        const template = templateData.templates.find(
          (t) => t.id === defaults.defaultTemplateId
        );
        if (!template) {
          setLoading(false);
          return;
        }

        setSheetUrl(defaults.sheetUrl);
        setSheetData(sheetData.headers, sheetData.rows);
        setTemplate(template);
        setMapping(defaults.mappings![defaults.defaultTemplateId!]);

        navigate('/preview', { replace: true });
      } catch (err) {
        console.error('Auto-start failed:', err);
      } finally {
        setLoading(false);
      }
    }

    run();
  }, []);

  return { loading };
}
