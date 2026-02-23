import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCreateDeck, useUpdateDeck, useDeck } from '../hooks/useDecks';
import { useGame } from '../hooks/useGames';
import { useSheetTabs } from '../hooks/useSheetTabs';
import { fetchTemplates, fetchCardbacks, fetchSheetData, renderPreview } from '../api/client';
import { buildTabCsvUrl } from '../api/sheetUtils';
import FieldMapper from '../components/FieldMapper';
import AssetBrowser from '../components/AssetBrowser';
import type { FieldMapping, CardData } from '@cardmaker/shared';
import {
  CARD_SIZE_PRESETS,
  CARD_WIDTH_INCHES,
  CARD_HEIGHT_INCHES,
  MAX_CARD_INCHES,
  resolveCardDimensions,
  type CardSizePresetName,
} from '@cardmaker/shared';

export default function DeckEditor() {
  const { id: gameId, deckId } = useParams<{ id: string; deckId: string }>();
  const navigate = useNavigate();
  const isEditing = !!deckId;

  const { data: gameData } = useGame(gameId);
  const { data: existingDeck } = useDeck(isEditing ? deckId : undefined);
  const sheetUrl = gameData?.game.sheetUrl ?? '';

  const createDeck = useCreateDeck();
  const updateDeck = useUpdateDeck();
  const { data: tabs, isLoading: tabsLoading } = useSheetTabs(sheetUrl || undefined);
  const { data: templateData } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });
  const { data: cardbackData } = useQuery({
    queryKey: ['cardbacks', gameId],
    queryFn: () => fetchCardbacks(gameId!),
    enabled: !!gameId,
  });

  // Form state
  const [name, setName] = useState('');
  const [selectedTabGid, setSelectedTabGid] = useState('');
  const [selectedTabName, setSelectedTabName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [cardBackImage, setCardBackImage] = useState('');
  const [cardSizePreset, setCardSizePreset] = useState<CardSizePresetName>('poker');
  const [customWidth, setCustomWidth] = useState(2.5);
  const [customHeight, setCustomHeight] = useState(3.5);
  const [landscape, setLandscape] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Sheet data
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<CardData[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);

  // Preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewKey = useRef(0);

  // Asset browser
  const [assetBrowserOpen, setAssetBrowserOpen] = useState(false);
  const [assetBrowserCategory, setAssetBrowserCategory] = useState<'cardart' | 'cardback' | 'icons' | 'covers'>('cardback');
  const [browsingForSlot, setBrowsingForSlot] = useState<string | null>(null);

  const templates = templateData?.templates ?? [];
  const selectedTemplate = templates.find((t) => t.id === templateId);

  // Resolve current card dimensions
  const presetInfo = cardSizePreset !== 'custom' ? CARD_SIZE_PRESETS[cardSizePreset] : undefined;
  const curWidthIn = cardSizePreset === 'custom' ? customWidth : (presetInfo?.width ?? CARD_WIDTH_INCHES);
  const curHeightIn = cardSizePreset === 'custom' ? customHeight : (presetInfo?.height ?? CARD_HEIGHT_INCHES);
  const resolvedDims = resolveCardDimensions(curWidthIn, curHeightIn, cardSizePreset !== 'custom' ? landscape : false);
  const dimsInput = {
    cardSizePreset,
    ...(cardSizePreset === 'custom' ? { cardWidthInches: customWidth, cardHeightInches: customHeight } : {}),
    ...(cardSizePreset !== 'custom' && landscape ? { landscape: true } : {}),
  };

  // Populate form when editing
  useEffect(() => {
    if (isEditing && existingDeck && !initialized) {
      setName(existingDeck.name);
      setSelectedTabGid(existingDeck.sheetTabGid);
      setSelectedTabName(existingDeck.sheetTabName);
      setTemplateId(existingDeck.templateId);
      setMapping(existingDeck.mapping);
      setCardBackImage(existingDeck.cardBackImage ?? '');
      setCardSizePreset(existingDeck.cardSizePreset ?? 'poker');
      if (existingDeck.cardWidthInches) setCustomWidth(existingDeck.cardWidthInches);
      if (existingDeck.cardHeightInches) setCustomHeight(existingDeck.cardHeightInches);
      setLandscape(existingDeck.landscape ?? false);
      setInitialized(true);
    }
  }, [existingDeck, isEditing, initialized]);

  // Fetch sheet data when tab is selected
  useEffect(() => {
    if (!selectedTabGid || !sheetUrl) return;
    if (sheetHeaders.length > 0) return;
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
  }, [selectedTabGid, sheetUrl]);

  // Render preview when mapping or dimensions change
  const dimsKey = JSON.stringify(dimsInput);
  useEffect(() => {
    if (!templateId || !sheetRows.length || Object.values(mapping).every((v) => !v)) {
      setPreviewUrl(null);
      return;
    }
    const key = ++previewKey.current;
    setLoadingPreview(true);
    const cardIndex = Math.min(previewIndex, sheetRows.length - 1);
    renderPreview(templateId, sheetRows[cardIndex], mapping, gameId, dimsInput)
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
  }, [templateId, mapping, sheetRows, previewIndex, dimsKey]);

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

  const handleAutoMap = () => {
    if (!selectedTemplate || sheetHeaders.length === 0) return;
    const newMapping: FieldMapping = { ...mapping };
    const allSlots = [
      ...selectedTemplate.fields.map((f) => ({ name: f.name, label: f.label })),
      ...selectedTemplate.imageSlots.map((s) => ({ name: s.name, label: s.label })),
    ];

    for (const slot of allSlots) {
      if (newMapping[slot.name]) continue; // Already mapped
      const lowerLabel = slot.label.toLowerCase();
      const lowerName = slot.name.toLowerCase();
      const match = sheetHeaders.find((h) => {
        const lh = h.toLowerCase();
        return lh === lowerLabel || lh === lowerName
          || lh.includes(lowerLabel) || lowerLabel.includes(lh)
          || lh.includes(lowerName) || lowerName.includes(lh);
      });
      if (match) {
        newMapping[slot.name] = match;
      }
    }
    setMapping(newMapping);
  };

  const handleBrowseImage = (slotName: string) => {
    setBrowsingForSlot(slotName);
    setAssetBrowserCategory('cardart');
    setAssetBrowserOpen(true);
  };

  const handleBrowseCardBack = () => {
    setBrowsingForSlot(null);
    setAssetBrowserCategory('cardback');
    setAssetBrowserOpen(true);
  };

  const handleAssetSelect = (filename: string) => {
    if (browsingForSlot) {
      // This sets a value in the mapping, not the column - but for image slots
      // the user would typically already have mapped the column. The browse here
      // is informational. Close the browser.
    } else {
      // Card back selection
      setCardBackImage(filename);
    }
    setAssetBrowserOpen(false);
    setBrowsingForSlot(null);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !selectedTabGid || !templateId) {
      setError('Name, sheet, and template are required');
      return;
    }
    setError('');
    const sizeFields = {
      cardSizePreset,
      ...(cardSizePreset === 'custom'
        ? { cardWidthInches: customWidth, cardHeightInches: customHeight, landscape: false }
        : { cardWidthInches: undefined, cardHeightInches: undefined, landscape: landscape || undefined }),
    } as const;
    try {
      if (isEditing && existingDeck) {
        await updateDeck.mutateAsync({
          id: existingDeck.id,
          name: name.trim(),
          sheetTabGid: selectedTabGid,
          sheetTabName: selectedTabName,
          templateId,
          mapping,
          cardBackImage: cardBackImage || '',
          ...sizeFields,
        });
        navigate(`/games/${gameId}/decks/${deckId}`);
      } else {
        const newDeck = await createDeck.mutateAsync({
          gameId: gameId!,
          name: name.trim(),
          sheetTabGid: selectedTabGid,
          sheetTabName: selectedTabName,
          templateId,
          mapping,
          cardBackImage: cardBackImage || '',
          ...sizeFields,
        });
        navigate(`/games/${gameId}/decks/${newDeck.id}`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const isPending = createDeck.isPending || updateDeck.isPending;

  if (!gameData) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading game...</p>;
  }

  const sampleRow = sheetRows.length > 0 ? sheetRows[Math.min(previewIndex, sheetRows.length - 1)] : undefined;

  return (
    <div className="deck-editor">
      <h1 style={{ fontSize: 26, marginBottom: 'var(--sp-5)' }}>
        {isEditing ? 'Edit Deck' : 'New Deck'}
      </h1>

      {/* Top form */}
      <div className="deck-editor-form">
        <div>
          <label htmlFor="deck-name" className="form-label">Deck Name *</label>
          <input
            id="deck-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Action Cards"
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label htmlFor="deck-template" className="form-label">Template *</label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <select
              id="deck-template"
              value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); setMapping({}); }}
              style={{ flex: 1 }}
            >
              <option value="">Select a template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {templateId && (
              <Link
                to={`/templates/${templateId}`}
                className="secondary sm"
                style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
                title="View template"
              >
                View
              </Link>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="deck-size" className="form-label">Card Size</label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              id="deck-size"
              value={cardSizePreset}
              onChange={(e) => setCardSizePreset(e.target.value as CardSizePresetName)}
              style={{ flex: '0 0 auto' }}
            >
              {Object.entries(CARD_SIZE_PRESETS).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label} ({val.width}" x {val.height}")
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
            {cardSizePreset === 'custom' && (
              <>
                <input
                  type="number"
                  min={1}
                  max={MAX_CARD_INCHES}
                  step={0.01}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  style={{ width: 72 }}
                  title="Width (inches)"
                />
                <span style={{ color: 'var(--text-muted)' }}>x</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_CARD_INCHES}
                  step={0.01}
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                  style={{ width: 72 }}
                  title="Height (inches)"
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>inches</span>
              </>
            )}
            {cardSizePreset !== 'custom' && (
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
                <input
                  type="checkbox"
                  checked={landscape}
                  onChange={(e) => setLandscape(e.target.checked)}
                />
                Landscape
              </label>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="deck-sheet" className="form-label">Sheet *</label>
          {tabsLoading ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Discovering sheets...</p>
          ) : (
            <select
              id="deck-sheet"
              value={selectedTabGid}
              onChange={(e) => handleTabChange(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Select a sheet</option>
              {tabs?.map((tab) => (
                <option key={tab.gid} value={tab.gid}>{tab.name}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="deck-cardback" className="form-label">Card Back</label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <select
              id="deck-cardback"
              value={cardBackImage}
              onChange={(e) => setCardBackImage(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">None</option>
              {cardbackData?.images.map((img) => (
                <option key={img} value={img}>{img}</option>
              ))}
            </select>
            <button className="secondary sm" onClick={handleBrowseCardBack}>
              Browse
            </button>
          </div>
        </div>
      </div>

      {/* Body: field mapping + preview */}
      {selectedTemplate && selectedTabGid && (
        <div className="deck-editor-body">
          <div className="deck-editor-mapping">
            {loadingSheet ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading sheet data...</p>
            ) : sheetHeaders.length > 0 ? (
              <FieldMapper
                template={selectedTemplate}
                sheetHeaders={sheetHeaders}
                mapping={mapping}
                onFieldMappingChange={handleFieldMappingChange}
                sampleRow={sampleRow}
                onAutoMap={handleAutoMap}
                onBrowseImage={handleBrowseImage}
              />
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Waiting for sheet data...</p>
            )}
          </div>

          <div className="deck-editor-preview">
            <h3>Preview</h3>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                aspectRatio: `${resolvedDims.widthCss} / ${resolvedDims.heightCss}`,
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
                  className="secondary sm"
                  onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                  disabled={previewIndex === 0}
                >
                  {'\u2190'}
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Card {previewIndex + 1} of {sheetRows.length}
                </span>
                <button
                  className="secondary sm"
                  onClick={() => setPreviewIndex((i) => Math.min(sheetRows.length - 1, i + 1))}
                  disabled={previewIndex >= sheetRows.length - 1}
                >
                  {'\u2192'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--error)', fontSize: 13, marginTop: 'var(--sp-3)' }}>{error}</div>
      )}

      {/* Footer */}
      <div className="deck-editor-footer">
        <div className="spacer" />
        <button className="secondary" onClick={() => navigate(`/games/${gameId}`)}>
          Cancel
        </button>
        <button
          className="primary"
          onClick={handleSubmit}
          disabled={!name.trim() || !selectedTabGid || !templateId || isPending}
        >
          {isPending
            ? (isEditing ? 'Saving...' : 'Creating...')
            : (isEditing ? 'Save Deck' : 'Create Deck')}
        </button>
      </div>

      {/* Asset Browser */}
      {assetBrowserOpen && gameId && (
        <AssetBrowser
          gameId={gameId}
          category={assetBrowserCategory}
          onCategoryChange={setAssetBrowserCategory}
          onSelect={handleAssetSelect}
          onClose={() => { setAssetBrowserOpen(false); setBrowsingForSlot(null); }}
          selectedValue={browsingForSlot ? undefined : cardBackImage}
        />
      )}
    </div>
  );
}
