import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../stores/appStore';
import { fetchTemplates, renderPreview } from '../api/client';
import { useDefaults } from '../hooks/useDefaults';
import FieldMapper from './FieldMapper';
import SaveDefaultsButton from './SaveDefaultsButton';
import ClearDefaultButton from './ClearDefaultButton';

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TemplateModal({ open, onClose }: TemplateModalProps) {
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

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-panel"
        style={{ width: '100%', maxWidth: 800, maxHeight: '80vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Template & Field Mapping</h2>
          <button
            className="secondary"
            onClick={onClose}
            style={{ padding: 'var(--sp-1) 10px', fontSize: 13 }}
          >
            Close
          </button>
        </div>

        {rows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            No data loaded. Please set up a data source first.
          </p>
        ) : (
          <>
            <div>
              <h3 style={{ marginBottom: 'var(--sp-2)' }}>Select Template</h3>
              {isLoading && <p>Loading templates...</p>}
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
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
              <div style={{ display: 'flex', gap: 'var(--sp-5)' }}>
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
                    gap: 'var(--sp-2)',
                  }}
                >
                  <h3>Preview</h3>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
              <ClearDefaultButton target="template" />
              <SaveDefaultsButton />
              <button
                className="primary"
                onClick={onClose}
                disabled={!selectedTemplate || Object.keys(mapping).length === 0}
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
