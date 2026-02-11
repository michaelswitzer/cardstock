import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateDeck, useUpdateDeck } from '../hooks/useDecks';
import { useSheetTabs } from '../hooks/useSheetTabs';
import { fetchTemplates, fetchCardbacks, fetchSheetData, renderPreview } from '../api/client';
import { buildTabCsvUrl } from '../api/sheetUtils';
import FieldMapper from './FieldMapper';
import type { Deck, FieldMapping, CardData } from '@cardmaker/shared';

interface CreateDeckModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  sheetUrl: string;
  existingDeck?: Deck | null;
}

export default function CreateDeckModal({
  open,
  onClose,
  gameId,
  sheetUrl,
  existingDeck,
}: CreateDeckModalProps) {
  const createDeck = useCreateDeck();
  const updateDeck = useUpdateDeck();
  const { data: tabs, isLoading: tabsLoading } = useSheetTabs(open ? sheetUrl : undefined);
  const { data: templateData } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
    enabled: open,
  });
  const { data: cardbackData } = useQuery({
    queryKey: ['cardbacks'],
    queryFn: fetchCardbacks,
    enabled: open,
  });

  // Step state
  const [step, setStep] = useState<1 | 2>(1);

  // Form state
  const [name, setName] = useState('');
  const [selectedTabGid, setSelectedTabGid] = useState('');
  const [selectedTabName, setSelectedTabName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [cardBackImage, setCardBackImage] = useState('');
  const [error, setError] = useState('');

  // Sheet data for step 2
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<CardData[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewKey = useRef(0);

  const isEditing = !!existingDeck;
  const templates = templateData?.templates ?? [];
  const selectedTemplate = templates.find((t) => t.id === templateId);

  // Populate form when editing
  useEffect(() => {
    if (existingDeck && open) {
      setName(existingDeck.name);
      setSelectedTabGid(existingDeck.sheetTabGid);
      setSelectedTabName(existingDeck.sheetTabName);
      setTemplateId(existingDeck.templateId);
      setMapping(existingDeck.mapping);
      setCardBackImage(existingDeck.cardBackImage ?? '');
      setStep(1);
      setPreviewUrl(null);
      setPreviewIndex(0);
    } else if (!existingDeck && open) {
      setName('');
      setSelectedTabGid('');
      setSelectedTabName('');
      setTemplateId('');
      setMapping({});
      setCardBackImage('');
      setStep(1);
      setSheetHeaders([]);
      setSheetRows([]);
      setPreviewUrl(null);
      setPreviewIndex(0);
    }
  }, [existingDeck, open]);

  // Fetch sheet data when entering step 2 or when tab changes while on step 2
  useEffect(() => {
    if (step !== 2 || !selectedTabGid || !sheetUrl) return;
    if (sheetHeaders.length > 0) return; // Already loaded for this tab
    let cancelled = false;
    setLoadingSheet(true);
    const csvUrl = buildTabCsvUrl(sheetUrl, selectedTabGid);
    fetchSheetData(csvUrl)
      .then((data) => {
        if (!cancelled) {
          setSheetHeaders(data.headers);
          setSheetRows(data.rows);
        }
      })
      .catch((err) => {
        console.error('Sheet fetch failed:', err);
        if (!cancelled) setError('Failed to load sheet data: ' + (err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingSheet(false);
      });
    return () => { cancelled = true; };
  }, [step, selectedTabGid, sheetUrl]);

  // Render preview card when mapping changes
  useEffect(() => {
    if (step !== 2 || !templateId || !sheetRows.length || Object.values(mapping).every((v) => !v)) {
      setPreviewUrl(null);
      return;
    }
    const key = ++previewKey.current;
    setLoadingPreview(true);
    const cardIndex = Math.min(previewIndex, sheetRows.length - 1);
    renderPreview(templateId, sheetRows[cardIndex], mapping)
      .then((dataUrl) => {
        if (previewKey.current === key) {
          setPreviewUrl(dataUrl);
          setLoadingPreview(false);
        }
      })
      .catch((err) => {
        console.error('Preview render failed:', err);
        if (previewKey.current === key) {
          setPreviewUrl(null);
          setLoadingPreview(false);
        }
      });
  }, [step, templateId, mapping, sheetRows, previewIndex]);

  if (!open) return null;

  const handleTabChange = (gid: string) => {
    setSelectedTabGid(gid);
    const tab = tabs?.find((t) => t.gid === gid);
    setSelectedTabName(tab?.name ?? '');
    setMapping({});
    setSheetHeaders([]);
    setSheetRows([]);
  };

  const handleFieldMappingChange = (field: string, column: string) => {
    setMapping((prev) => ({ ...prev, [field]: column }));
  };

  const canProceedToStep2 = !!name.trim() && !!selectedTabGid && !!templateId;

  const handleNext = () => {
    if (!canProceedToStep2) {
      setError('Name, sheet, and template are required');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async () => {
    setError('');
    try {
      if (isEditing) {
        await updateDeck.mutateAsync({
          id: existingDeck.id,
          name: name.trim(),
          sheetTabGid: selectedTabGid,
          sheetTabName: selectedTabName,
          templateId,
          mapping,
          cardBackImage: cardBackImage || undefined,
        });
      } else {
        await createDeck.mutateAsync({
          gameId,
          name: name.trim(),
          sheetTabGid: selectedTabGid,
          sheetTabName: selectedTabName,
          templateId,
          mapping,
          cardBackImage: cardBackImage || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const isPending = createDeck.isPending || updateDeck.isPending;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        className="modal-panel"
        style={{
          width: '100%',
          maxWidth: step === 2 ? 900 : 600,
          maxHeight: '90vh',
          overflowY: 'auto',
          transition: 'max-width 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <h2>{isEditing ? 'Edit Deck' : 'New Deck'}</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Step {step} of 2
            </span>
          </div>
          <button
            className="secondary"
            onClick={onClose}
            style={{ padding: 'var(--sp-1) 10px', fontSize: 13 }}
          >
            Close
          </button>
        </div>

        {/* Step 1: Basic config */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 'var(--sp-1)' }}>
                Deck Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Action Cards"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 'var(--sp-1)' }}>
                Sheet *
              </label>
              {tabsLoading ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Discovering sheets...</p>
              ) : (
                <select
                  value={selectedTabGid}
                  onChange={(e) => handleTabChange(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Select a sheet</option>
                  {tabs?.map((tab) => (
                    <option key={tab.gid} value={tab.gid}>
                      {tab.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 'var(--sp-1)' }}>
                Template *
              </label>
              <select
                value={templateId}
                onChange={(e) => { setTemplateId(e.target.value); setMapping({}); }}
                style={{ width: '100%' }}
              >
                <option value="">Select a template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 'var(--sp-1)' }}>
                Card Back Image
              </label>
              <select
                value={cardBackImage}
                onChange={(e) => setCardBackImage(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">None</option>
                {cardbackData?.images.map((img) => (
                  <option key={img} value={img}>{img}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Field mapping + preview */}
        {step === 2 && (
          <div style={{ display: 'flex', gap: 'var(--sp-5)', minHeight: 400 }}>
            {/* Left: field mapper */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {loadingSheet ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading sheet data...</p>
              ) : selectedTemplate && sheetHeaders.length > 0 ? (
                <FieldMapper
                  template={selectedTemplate}
                  sheetHeaders={sheetHeaders}
                  mapping={mapping}
                  onFieldMappingChange={handleFieldMappingChange}
                />
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>
                  Waiting for sheet data...
                </p>
              )}
            </div>

            {/* Right: card preview */}
            <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <h3>Preview</h3>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  aspectRatio: '250 / 350',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {loadingPreview && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Rendering...</span>
                )}
                {!loadingPreview && previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Card preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                )}
                {!loadingPreview && !previewUrl && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 'var(--sp-3)' }}>
                    Map at least one field to see a preview
                  </span>
                )}
              </div>
              {sheetRows.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', justifyContent: 'center' }}>
                  <button
                    className="secondary"
                    style={{ padding: 'var(--sp-1) var(--sp-2)', fontSize: 12 }}
                    onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                    disabled={previewIndex === 0}
                  >
                    &larr;
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Card {previewIndex + 1} of {sheetRows.length}
                  </span>
                  <button
                    className="secondary"
                    style={{ padding: 'var(--sp-1) var(--sp-2)', fontSize: 12 }}
                    onClick={() => setPreviewIndex((i) => Math.min(sheetRows.length - 1, i + 1))}
                    disabled={previewIndex >= sheetRows.length - 1}
                  >
                    &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--error)', fontSize: 13 }}>{error}</div>
        )}

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {step === 2 && (
            <button className="secondary" onClick={() => setStep(1)}>
              Back
            </button>
          )}
          {step === 1 && isEditing && (
            <button
              className="primary"
              onClick={handleSubmit}
              disabled={!canProceedToStep2 || isPending}
            >
              {isPending ? 'Saving...' : 'Save Deck'}
            </button>
          )}
          {step === 1 && (
            <button
              className={isEditing ? 'secondary' : 'primary'}
              onClick={handleNext}
              disabled={!canProceedToStep2}
            >
              {isEditing ? 'Edit Mappings' : 'Next: Map Fields'}
            </button>
          )}
          {step === 2 && (
            <button
              className="primary"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending
                ? (isEditing ? 'Saving...' : 'Creating...')
                : (isEditing ? 'Save Deck' : 'Create Deck')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
