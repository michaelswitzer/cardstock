import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { renderPreviewBatch } from '../api/client';
import CardGrid from '../components/CardGrid';

export default function CardPreviewPage() {
  const navigate = useNavigate();
  const {
    rows,
    selectedTemplate,
    mapping,
    selectedCards,
    toggleCardSelection,
    selectAllCards,
    deselectAllCards,
  } = useAppStore();

  const [cardImages, setCardImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const renderKey = useRef<number>(0);

  useEffect(() => {
    if (!selectedTemplate || rows.length === 0 || Object.keys(mapping).length === 0) return;

    const key = ++renderKey.current;
    setLoading(true);

    renderPreviewBatch(selectedTemplate.id, rows, mapping)
      .then((dataUrls) => {
        if (renderKey.current === key) {
          setCardImages(dataUrls);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Batch preview failed:', err);
        if (renderKey.current === key) setLoading(false);
      });
  }, [selectedTemplate, mapping, rows]);

  if (!selectedTemplate) {
    return (
      <div>
        <p>No template selected. Please go back and choose a template first.</p>
        <button className="secondary" onClick={() => navigate('/template')}>
          Back to Template
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2>Card Preview</h2>

      {loading && (
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Rendering {rows.length} cards...
        </p>
      )}

      {!loading && cardImages.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="secondary" onClick={selectAllCards}>Select All</button>
            <button className="secondary" onClick={deselectAllCards}>Deselect All</button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {selectedCards.length} of {rows.length} cards selected
              {selectedCards.length === 0 && ' (all will be exported)'}
            </span>
          </div>
          <CardGrid
            cardImages={cardImages}
            selectedCards={selectedCards}
            onToggle={toggleCardSelection}
          />
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="secondary" onClick={() => navigate('/template')}>
          Back
        </button>
        <button
          className="primary"
          onClick={() => navigate('/export')}
          disabled={loading}
        >
          Next: Export
        </button>
      </div>
    </div>
  );
}
