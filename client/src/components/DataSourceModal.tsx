import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '../stores/appStore';
import { fetchSheetData } from '../api/client';
import { useDefaults } from '../hooks/useDefaults';
import DataTable from './DataTable';
import SaveDefaultsButton from './SaveDefaultsButton';
import ClearDefaultButton from './ClearDefaultButton';

interface DataSourceModalProps {
  open: boolean;
  onClose: () => void;
  onContinueToTemplate: () => void;
}

export default function DataSourceModal({ open, onClose, onContinueToTemplate }: DataSourceModalProps) {
  const { sheetUrl, setSheetUrl, setSheetData, headers, rows } = useAppStore();
  const [inputUrl, setInputUrl] = useState(sheetUrl);
  const { data: defaults } = useDefaults();

  // Auto-populate URL from saved defaults
  useEffect(() => {
    if (defaults?.sheetUrl && !inputUrl) {
      setInputUrl(defaults.sheetUrl);
    }
  }, [defaults]);

  // Sync input when store URL changes (e.g. from auto-start)
  useEffect(() => {
    if (sheetUrl && !inputUrl) {
      setInputUrl(sheetUrl);
    }
  }, [sheetUrl]);

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

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          padding: 24,
          width: '100%',
          maxWidth: 700,
          maxHeight: '80vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Data Source</h2>
          <button
            className="secondary"
            onClick={onClose}
            style={{ padding: '4px 10px', fontSize: 13 }}
          >
            Close
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Paste the URL of a published Google Sheet. The sheet must be published to
          the web (File &rarr; Share &rarr; Publish to web).
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
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
          <div style={{ color: 'var(--primary)', fontSize: 14 }}>
            Error: {(fetchMutation.error as Error).message}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {rows.length} rows loaded with {headers.length} columns
            </p>
            <DataTable headers={headers} rows={rows} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <ClearDefaultButton target="dataSource" />
              <SaveDefaultsButton />
              <button className="primary" onClick={onContinueToTemplate}>
                Continue to Template
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
