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
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>Cardstock</h1>
        <p style={{ color: 'var(--text-muted)' }}>Loading saved session...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24 }}>Cardstock</h1>
        <div style={{ display: 'flex', gap: 8 }}>
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
              style={{ background: '#000' }}
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
