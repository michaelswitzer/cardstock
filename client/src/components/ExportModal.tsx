import { useState, useEffect, useRef } from 'react';
import type { ExportJob, ExportFormat } from '@cardmaker/shared';
import { useAppStore } from '../stores/appStore';
import { startExport, getExportJob } from '../api/client';
import ExportProgress from './ExportProgress';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportModal({ open, onClose }: ExportModalProps) {
  const { rows, selectedTemplate, mapping, exportFormat, setExportFormat } =
    useAppStore();

  const [job, setJob] = useState<ExportJob | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pdfPageSize, setPdfPageSize] = useState<'letter' | 'a4'>('letter');
  const [pdfCropMarks, setPdfCropMarks] = useState(true);
  const [ttsColumns, setTtsColumns] = useState(10);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (!open || !selectedTemplate) return null;

  const handleExport = async () => {
    setExporting(true);
    setJob(null);

    try {
      const jobId = await startExport(selectedTemplate.id, rows, mapping, {
        format: exportFormat,
        selectedCards: [],
        pdfPageSize,
        pdfCropMarks,
        ttsColumns,
      });

      pollRef.current = setInterval(async () => {
        const status = await getExportJob(jobId);
        setJob(status);
        if (status.status === 'complete' || status.status === 'error') {
          clearInterval(pollRef.current);
          setExporting(false);
        }
      }, 500);
    } catch (err) {
      setExporting(false);
      setJob({
        id: '',
        status: 'error',
        progress: 0,
        total: 0,
        completed: 0,
        format: exportFormat,
        error: (err as Error).message,
      });
    }
  };

  const formatOptions: { value: ExportFormat; label: string; desc: string }[] = [
    { value: 'png', label: 'PNG Images', desc: 'Individual 750x1050 card images at 300 DPI' },
    { value: 'pdf', label: 'Print PDF', desc: 'Cards arranged on pages with crop marks' },
    { value: 'tts', label: 'TTS Sprite Sheet', desc: 'Grid image for Tabletop Simulator' },
  ];

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !exporting) onClose();
      }}
    >
      <div
        className="modal-panel"
        style={{ width: '100%', maxWidth: 560 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Export</h2>
          {!exporting && (
            <button
              className="secondary"
              onClick={onClose}
              style={{ padding: 'var(--sp-1) 10px', fontSize: 13 }}
            >
              Close
            </button>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 'var(--sp-2)' }}>Format</h3>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {formatOptions.map((opt) => (
              <button
                key={opt.value}
                className={exportFormat === opt.value ? 'primary' : 'secondary'}
                onClick={() => setExportFormat(opt.value)}
                style={{ flex: 1, textAlign: 'left', padding: 'var(--sp-3) var(--sp-4)' }}
              >
                <div style={{ fontWeight: 600 }}>{opt.label}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 'var(--sp-1)' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {exportFormat === 'pdf' && (
          <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
            <label style={{ fontSize: 14 }}>
              Page Size:
              <select
                value={pdfPageSize}
                onChange={(e) => setPdfPageSize(e.target.value as 'letter' | 'a4')}
                style={{ marginLeft: 'var(--sp-2)' }}
              >
                <option value="letter">Letter (8.5 x 11")</option>
                <option value="a4">A4 (210 x 297mm)</option>
              </select>
            </label>
            <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <input
                type="checkbox"
                checked={pdfCropMarks}
                onChange={(e) => setPdfCropMarks(e.target.checked)}
              />
              Crop Marks
            </label>
          </div>
        )}

        {exportFormat === 'tts' && (
          <label style={{ fontSize: 14 }}>
            Columns:
            <input
              type="number"
              min={1}
              max={10}
              value={ttsColumns}
              onChange={(e) => setTtsColumns(Number(e.target.value))}
              style={{ width: 60, marginLeft: 'var(--sp-2)' }}
            />
          </label>
        )}

        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Exporting all {rows.length} cards
        </div>

        <button
          className="primary"
          onClick={handleExport}
          disabled={exporting}
          style={{ alignSelf: 'flex-start', padding: 'var(--sp-3) var(--sp-6)', fontSize: 16 }}
        >
          {exporting ? 'Exporting...' : 'Start Export'}
        </button>

        <ExportProgress job={job} />
      </div>
    </div>
  );
}
