import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ExportJob, ExportFormat } from '@cardmaker/shared';
import { useAppStore } from '../stores/appStore';
import { startExport, getExportJob } from '../api/client';
import ExportProgress from '../components/ExportProgress';

export default function ExportPage() {
  const navigate = useNavigate();
  const { rows, selectedTemplate, mapping, selectedCards, exportFormat, setExportFormat } =
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

  const handleExport = async () => {
    if (!selectedTemplate) return;
    setExporting(true);
    setJob(null);

    try {
      const jobId = await startExport(selectedTemplate.id, rows, mapping, {
        format: exportFormat,
        selectedCards,
        pdfPageSize,
        pdfCropMarks,
        ttsColumns,
      });

      // Poll for job status
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

  if (!selectedTemplate) {
    return (
      <div>
        <p>No template selected. Please complete previous steps first.</p>
        <button className="secondary" onClick={() => navigate('/data')}>
          Start Over
        </button>
      </div>
    );
  }

  const formatOptions: { value: ExportFormat; label: string; desc: string }[] = [
    { value: 'png', label: 'PNG Images', desc: 'Individual 750x1050 card images at 300 DPI' },
    { value: 'pdf', label: 'Print PDF', desc: 'Cards arranged on pages with crop marks' },
    { value: 'tts', label: 'TTS Sprite Sheet', desc: 'Grid image for Tabletop Simulator' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2>Export</h2>

      <div>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>Format</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {formatOptions.map((opt) => (
            <button
              key={opt.value}
              className={exportFormat === opt.value ? 'primary' : 'secondary'}
              onClick={() => setExportFormat(opt.value)}
              style={{ flex: 1, textAlign: 'left', padding: '12px 16px' }}
            >
              <div style={{ fontWeight: 600 }}>{opt.label}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {exportFormat === 'pdf' && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label style={{ fontSize: 14 }}>
            Page Size:
            <select
              value={pdfPageSize}
              onChange={(e) => setPdfPageSize(e.target.value as 'letter' | 'a4')}
              style={{ marginLeft: 8 }}
            >
              <option value="letter">Letter (8.5 x 11")</option>
              <option value="a4">A4 (210 x 297mm)</option>
            </select>
          </label>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
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
            style={{ width: 60, marginLeft: 8 }}
          />
        </label>
      )}

      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
        {selectedCards.length > 0
          ? `Exporting ${selectedCards.length} selected cards`
          : `Exporting all ${rows.length} cards`}
      </div>

      <button
        className="primary"
        onClick={handleExport}
        disabled={exporting}
        style={{ alignSelf: 'flex-start', padding: '12px 32px', fontSize: 16 }}
      >
        {exporting ? 'Exporting...' : 'Start Export'}
      </button>

      <ExportProgress job={job} />

      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button className="secondary" onClick={() => navigate('/preview')}>
          Back to Cards
        </button>
      </div>
    </div>
  );
}
