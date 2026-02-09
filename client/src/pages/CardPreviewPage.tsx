import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { renderPreviewBatch } from '../api/client';
import CardGrid from '../components/CardGrid';
import DataSourceModal from '../components/DataSourceModal';
import TemplateModal from '../components/TemplateModal';

export default function CardPreviewPage() {
  const {
    rows,
    selectedTemplate,
    mapping,
    cardImages,
    cardImagesKey,
    setCardImages,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [showDataSource, setShowDataSource] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const renderKey = useRef<number>(0);

  useEffect(() => {
    if (!selectedTemplate || rows.length === 0 || Object.keys(mapping).length === 0) return;

    const inputsKey = JSON.stringify({ t: selectedTemplate.id, m: mapping, r: rows });
    if (cardImages.length > 0 && inputsKey === cardImagesKey) return;

    const key = ++renderKey.current;
    setLoading(true);

    renderPreviewBatch(selectedTemplate.id, rows, mapping)
      .then((dataUrls) => {
        if (renderKey.current === key) {
          setCardImages(dataUrls, inputsKey);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Batch preview failed:', err);
        if (renderKey.current === key) setLoading(false);
      });
  }, [selectedTemplate, mapping, rows]);

  const isConfigured = !!selectedTemplate && rows.length > 0 && Object.keys(mapping).length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="secondary" onClick={() => setShowDataSource(true)}>
          Data Source
        </button>
        <button className="secondary" onClick={() => setShowTemplate(true)}>
          Template
        </button>
      </div>

      {!isConfigured && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h3 style={{ marginBottom: 8 }}>No cards to show yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            Connect a spreadsheet and choose a template to start making cards.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="primary" onClick={() => setShowDataSource(true)}>
              Set Up Data Source
            </button>
            <button className="secondary" onClick={() => setShowTemplate(true)}>
              Choose Template
            </button>
          </div>
        </div>
      )}

      {loading && (
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Rendering {rows.length} cards...
        </p>
      )}

      {!loading && cardImages.length > 0 && (
        <CardGrid cardImages={cardImages} />
      )}

      <DataSourceModal
        open={showDataSource}
        onClose={() => setShowDataSource(false)}
        onContinueToTemplate={() => {
          setShowDataSource(false);
          setShowTemplate(true);
        }}
      />
      <TemplateModal open={showTemplate} onClose={() => setShowTemplate(false)} />
    </div>
  );
}
