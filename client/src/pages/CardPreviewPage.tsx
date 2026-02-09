import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { renderPreviewBatch, fetchSheetData } from '../api/client';
import CardGrid from '../components/CardGrid';
import ExportModal from '../components/ExportModal';

export default function CardPreviewPage() {
  const navigate = useNavigate();
  const {
    rows,
    sheetUrl,
    selectedTemplate,
    mapping,
    cardImages,
    cardImagesKey,
    setCardImages,
    selectedCards,
    toggleCardSelection,
    selectAllCards,
    deselectAllCards,
    setSheetData,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);
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

  const handleRefresh = async () => {
    if (!sheetUrl) return;
    setRefreshing(true);
    try {
      const data = await fetchSheetData(sheetUrl);
      setSheetData(data.headers, data.rows);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  if (!selectedTemplate) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2 style={{ marginBottom: 8 }}>No cards to show yet</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
          Connect a spreadsheet and choose a template to start making cards.
        </p>
        <button className="primary" onClick={() => navigate('/data')}>
          Set Up Data Source
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Cards</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="secondary"
            onClick={handleRefresh}
            disabled={refreshing || !sheetUrl}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            className="primary"
            onClick={() => setShowExport(true)}
            disabled={loading}
          >
            Export
          </button>
        </div>
      </div>

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

      <ExportModal open={showExport} onClose={() => setShowExport(false)} />
    </div>
  );
}
