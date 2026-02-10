import { useState } from 'react';
import { useAppStore } from './stores/appStore';
import { fetchSheetData } from './api/client';
import CardPreviewPage from './pages/CardPreviewPage';
import ExportModal from './components/ExportModal';
import { useAutoStart } from './hooks/useAutoStart';

export default function App() {
  const { loading } = useAutoStart();
  const { sheetUrl, selectedTemplate, rows, mapping, setSheetData } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const isConfigured = !!selectedTemplate && rows.length > 0 && Object.keys(mapping).length > 0;

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

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--sp-5)' }}>
        <h1 style={{ fontSize: 26, marginBottom: 'var(--sp-4)' }}>Cardstock <span style={{ color: 'var(--primary)' }}>{'\u{1F0CF}'}</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>Loading saved session...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--sp-5)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
        <h1 style={{ fontSize: 26 }}>Cardstock <span style={{ color: 'var(--primary)' }}>{'\u{1F0CF}'}</span></h1>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {sheetUrl && (
            <button
              className="secondary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
          {isConfigured && (
            <button
              className="primary"
              onClick={() => setShowExport(true)}

            >
              Export
            </button>
          )}
        </div>
      </header>
      <main>
        <CardPreviewPage />
      </main>
      <ExportModal open={showExport} onClose={() => setShowExport(false)} />
    </div>
  );
}
