import { useState, useEffect, useRef } from 'react';
import type { CardData, ExportJob, ExportFormat, FieldMapping } from '@cardmaker/shared';
import type { CardSizePresetName } from '@cardmaker/shared';
import {
  CARD_SIZE_PRESETS,
  CARD_WIDTH_INCHES,
  CARD_HEIGHT_INCHES,
  resolveCardDimensions,
} from '@cardmaker/shared';
import { useAppStore } from '../stores/appStore';
import { startExport, startGameExport, getExportJob } from '../api/client';
import ExportProgress from './ExportProgress';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  // For deck-scoped export:
  deckId?: string;
  rows?: CardData[];
  templateId?: string;
  mapping?: FieldMapping;
  cardBackImage?: string;
  // For game-scoped export:
  gameId?: string;
  // Card dimensions:
  cardSizePreset?: CardSizePresetName;
  cardWidthInches?: number;
  cardHeightInches?: number;
  landscape?: boolean;
}

export default function ExportModal({
  open,
  onClose,
  deckId,
  rows,
  templateId,
  mapping,
  cardBackImage,
  gameId,
  cardSizePreset,
  cardWidthInches,
  cardHeightInches,
  landscape,
}: ExportModalProps) {
  const { exportFormat, setExportFormat } = useAppStore();

  const [job, setJob] = useState<ExportJob | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pdfPageSize, setPdfPageSize] = useState<'letter' | 'a4'>('letter');
  const [pdfCropMarks, setPdfCropMarks] = useState(true);
  const [ttsColumns, setTtsColumns] = useState(10);
  const [includeCardBack, setIncludeCardBack] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (!open) return null;

  const isDeckExport = !!deckId && !!rows && !!templateId && !!mapping;
  const isGameExport = !!gameId;
  const cardCount = rows?.length ?? 0;
  const hasCardBack = isDeckExport ? !!cardBackImage : isGameExport;

  // Resolve card dimensions for display
  const dims = (() => {
    const preset = cardSizePreset;
    let w = CARD_WIDTH_INCHES;
    let h = CARD_HEIGHT_INCHES;
    if (preset && preset !== 'custom' && CARD_SIZE_PRESETS[preset]) {
      w = CARD_SIZE_PRESETS[preset].width;
      h = CARD_SIZE_PRESETS[preset].height;
    } else if (preset === 'custom' && cardWidthInches && cardHeightInches) {
      w = cardWidthInches;
      h = cardHeightInches;
    }
    return resolveCardDimensions(w, h, landscape);
  })();
  const dimsInput = {
    cardSizePreset,
    ...(cardSizePreset === 'custom' ? { cardWidthInches, cardHeightInches } : {}),
    ...(cardSizePreset !== 'custom' && landscape ? { landscape: true } : {}),
  };

  const handleExport = async () => {
    setExporting(true);
    setJob(null);

    try {
      let jobId: string;

      if (isGameExport) {
        jobId = await startGameExport(gameId, {
          format: exportFormat,
          selectedCards: [],
          pdfPageSize,
          pdfCropMarks,
          ttsColumns,
        });
      } else if (isDeckExport) {
        jobId = await startExport(templateId, rows, mapping, {
          format: exportFormat,
          selectedCards: [],
          pdfPageSize,
          pdfCropMarks,
          ttsColumns,
          includeCardBack: includeCardBack && !!cardBackImage,
          cardBackImage: includeCardBack ? cardBackImage : undefined,
        }, gameId!, dimsInput);
      } else {
        return;
      }

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
    { value: 'png', label: 'PNG Images', desc: `Individual ${dims.widthPx}x${dims.heightPx} card images at 300 DPI` },
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
        style={{ width: '100%', maxWidth: 600 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>
            {isGameExport ? 'Export All Decks' : 'Export'}
          </h2>
          {!exporting && (
            <button className="secondary sm" onClick={onClose}>Close</button>
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

        {hasCardBack && isDeckExport && (
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <input
              type="checkbox"
              checked={includeCardBack}
              onChange={(e) => setIncludeCardBack(e.target.checked)}
            />
            Include card back ({cardBackImage})
          </label>
        )}

        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {isGameExport
            ? 'Exporting all decks in this game'
            : `Exporting all ${cardCount} cards`}
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

        {job?.status === 'complete' && (
          <button
            className="secondary"
            onClick={() => { setJob(null); setExporting(false); }}
            style={{ alignSelf: 'flex-start' }}
          >
            Export Again
          </button>
        )}
      </div>
    </div>
  );
}
