import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { renderPreview } from '../api/client';
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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!selectedTemplate || rows.length === 0 || Object.keys(mapping).length === 0) return;

    let cancelled = false;
    setLoading(true);
    setProgress(0);

    async function renderAll() {
      const images: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (cancelled) return;
        try {
          const url = await renderPreview(selectedTemplate!.id, rows[i], mapping);
          images.push(url);
        } catch {
          images.push('');
        }
        setProgress(Math.round(((i + 1) / rows.length) * 100));
      }
      if (!cancelled) {
        setCardImages(images);
        setLoading(false);
      }
    }

    renderAll();
    return () => { cancelled = true; };
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
        <div>
          <p style={{ fontSize: 14 }}>Rendering cards... {progress}%</p>
          <div style={{ height: 6, background: 'var(--surface-light)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--success)', transition: 'width 0.3s' }} />
          </div>
        </div>
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
