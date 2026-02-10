import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '../stores/appStore';
import { fetchSheetData } from '../api/client';
import { useDefaults } from '../hooks/useDefaults';
import DataTable from '../components/DataTable';
import SaveDefaultsButton from '../components/SaveDefaultsButton';
import ClearDefaultButton from '../components/ClearDefaultButton';

export default function DataSourcePage() {
  const navigate = useNavigate();
  const { sheetUrl, setSheetUrl, setSheetData, headers, rows } = useAppStore();
  const [inputUrl, setInputUrl] = useState(sheetUrl);
  const { data: defaults } = useDefaults();

  // Auto-populate URL from saved defaults
  useEffect(() => {
    if (defaults?.sheetUrl && !inputUrl) {
      setInputUrl(defaults.sheetUrl);
    }
  }, [defaults]);

  const fetchMutation = useMutation({
    mutationFn: fetchSheetData,
    onSuccess: (data) => {
      setSheetUrl(inputUrl);
      setSheetData(data.headers, data.rows);
    },
  });

  const handleFetch = () => {
    if (!inputUrl.trim()) return;
    fetchMutation.mutate(inputUrl.trim());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <h2>Data Source</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Paste the URL of a published Google Sheet. The sheet must be published to
        the web (File &rarr; Share &rarr; Publish to web).
      </p>

      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <input
          type="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          style={{ flex: 1 }}
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
        />
        <button
          className="primary"
          onClick={handleFetch}
          disabled={fetchMutation.isPending || !inputUrl.trim()}
        >
          {fetchMutation.isPending ? 'Loading...' : 'Fetch Data'}
        </button>
      </div>

      {fetchMutation.isError && (
        <div style={{ color: 'var(--error)', fontSize: 14 }}>
          Error: {(fetchMutation.error as Error).message}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {rows.length} rows loaded with {headers.length} columns
          </p>
          <DataTable headers={headers} rows={rows} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
            <ClearDefaultButton target="dataSource" />
            <SaveDefaultsButton />
            <button className="primary" onClick={() => navigate('/template')}>
              Continue to Template
            </button>
          </div>
        </>
      )}
    </div>
  );
}
