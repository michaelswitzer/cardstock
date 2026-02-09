import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../stores/appStore';
import { fetchTemplates, renderPreview } from '../api/client';
import { useDefaults } from '../hooks/useDefaults';
import FieldMapper from '../components/FieldMapper';
import SaveDefaultsButton from '../components/SaveDefaultsButton';

export default function TemplateEditorPage() {
  const navigate = useNavigate();
  const { rows, headers, selectedTemplate, setTemplate, setMapping, mapping } = useAppStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { data: defaults } = useDefaults();

  const { data: templateData, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });

  // Auto-select template from defaults
  useEffect(() => {
    if (templateData?.templates && !selectedTemplate && defaults?.defaultTemplateId) {
      const t = templateData.templates.find((t) => t.id === defaults.defaultTemplateId);
      if (t) setTemplate(t);
    }
  }, [templateData, defaults]);

  // Auto-apply mapping from defaults when template is freshly selected
  useEffect(() => {
    if (
      selectedTemplate &&
      Object.keys(mapping).length === 0 &&
      defaults?.mappings?.[selectedTemplate.id]
    ) {
      setMapping(defaults.mappings[selectedTemplate.id]);
    }
  }, [selectedTemplate, mapping, defaults]);

  // Auto-render preview when mapping changes
  useEffect(() => {
    if (!selectedTemplate || rows.length === 0 || Object.keys(mapping).length === 0) {
      setPreviewUrl(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const url = await renderPreview(selectedTemplate.id, rows[0], mapping);
        setPreviewUrl(url);
      } catch (err) {
        console.error('Preview error:', err);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedTemplate, mapping, rows]);

  if (rows.length === 0) {
    return (
      <div>
        <p>No data loaded. Please go back and fetch a sheet first.</p>
        <button className="secondary" onClick={() => navigate('/data')}>
          Back to Data Source
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2>Template & Field Mapping</h2>

      <div>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>Select Template</h3>
        {isLoading && <p>Loading templates...</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {templateData?.templates.map((t) => (
            <button
              key={t.id}
              className={selectedTemplate?.id === t.id ? 'primary' : 'secondary'}
              onClick={() => setTemplate(t)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {selectedTemplate && (
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <FieldMapper template={selectedTemplate} sheetHeaders={headers} />
          </div>
          <div
            style={{
              width: 250,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <h3 style={{ fontSize: 16 }}>Preview</h3>
            {previewLoading && <p style={{ fontSize: 13 }}>Rendering...</p>}
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Card preview"
                style={{
                  width: '100%',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                }}
              />
            )}
            {!previewUrl && !previewLoading && (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '5/7',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}
              >
                Map fields to see preview
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <SaveDefaultsButton />
        <button
          className="primary"
          onClick={() => navigate('/preview')}
          disabled={!selectedTemplate || Object.keys(mapping).length === 0}
        >
          Done
        </button>
      </div>
    </div>
  );
}
