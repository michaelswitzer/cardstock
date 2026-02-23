import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDeck, useDeleteDeck } from '../hooks/useDecks';
import { useGame } from '../hooks/useGames';
import { useAppStore } from '../stores/appStore';
import { useQuery } from '@tanstack/react-query';
import { fetchSheetData, renderPreviewBatch, fetchTemplates } from '../api/client';
import { buildTabCsvUrl } from '../api/sheetUtils';
import CardGrid from '../components/CardGrid';
import DataTable from '../components/DataTable';
import ExportModal from '../components/ExportModal';
import {
  CARD_SIZE_PRESETS,
  CARD_WIDTH_INCHES,
  CARD_HEIGHT_INCHES,
  resolveCardDimensions,
} from '@cardmaker/shared';

type DeckTab = 'cards' | 'data';

export default function DeckView() {
  const { id: gameId, deckId } = useParams<{ id: string; deckId: string }>();
  const navigate = useNavigate();
  const { data: deck, isLoading: deckLoading } = useDeck(deckId);
  const { data: gameData } = useGame(gameId);
  const { data: templateData } = useQuery({ queryKey: ['templates'], queryFn: fetchTemplates });
  const template = templateData?.templates.find((t) => t.id === deck?.templateId);
  const templateName = template?.name ?? deck?.templateId;
  const { deckDataCache, setDeckData, setDeckCardImages, cardZoom, setCardZoom } = useAppStore();
  const deleteDeck = useDeleteDeck();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeTab, setActiveTab] = useState<DeckTab>('cards');
  const renderKey = useRef<number>(0);

  // Resolve card dimensions for this deck
  const deckPreset = deck?.cardSizePreset;
  const deckDims = (() => {
    const preset = deckPreset;
    let w = CARD_WIDTH_INCHES;
    let h = CARD_HEIGHT_INCHES;
    if (preset && preset !== 'custom' && CARD_SIZE_PRESETS[preset]) {
      w = CARD_SIZE_PRESETS[preset].width;
      h = CARD_SIZE_PRESETS[preset].height;
    } else if (preset === 'custom' && deck?.cardWidthInches && deck?.cardHeightInches) {
      w = deck.cardWidthInches;
      h = deck.cardHeightInches;
    }
    return resolveCardDimensions(w, h, deck?.landscape);
  })();
  const dimsInput = deck ? {
    cardSizePreset: deck.cardSizePreset,
    ...(deck.cardSizePreset === 'custom' ? { cardWidthInches: deck.cardWidthInches, cardHeightInches: deck.cardHeightInches } : {}),
    ...(deck.cardSizePreset !== 'custom' && deck.landscape ? { landscape: true } : {}),
  } : undefined;

  const cache = deckId ? deckDataCache[deckId] : undefined;
  const headers = cache?.headers ?? [];
  const rows = cache?.rows ?? [];
  const cardImages = cache?.cardImages ?? [];
  const cardImagesKey = cache?.cardImagesKey ?? '';

  // Fetch sheet data and render cards when deck loads
  useEffect(() => {
    if (!deck || !gameData || !deckId) return;
    if (rows.length > 0) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const csvUrl = buildTabCsvUrl(gameData.game.sheetUrl, deck.sheetTabGid);
        const data = await fetchSheetData(csvUrl);
        if (!cancelled) {
          setDeckData(deckId, data.headers, data.rows);
        }
      } catch (err) {
        console.error('Failed to load sheet data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [deck?.id, gameData?.game.sheetUrl]);

  // Stable serialization of mapping for dependency comparison
  const mappingKey = JSON.stringify(deck?.mapping ?? {});

  // Render card images when data is available
  useEffect(() => {
    if (!deck || !deckId || rows.length === 0 || Object.keys(deck.mapping).length === 0) return;

    const inputsKey = JSON.stringify({ t: deck.templateId, m: deck.mapping, r: rows });
    if (cardImages.length > 0 && inputsKey === cardImagesKey) return;

    const key = ++renderKey.current;
    setLoading(true);

    renderPreviewBatch(deck.templateId, rows, deck.mapping, gameId, dimsInput)
      .then((dataUrls) => {
        if (renderKey.current === key) {
          setDeckCardImages(deckId, dataUrls, inputsKey);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Batch preview failed:', err);
        if (renderKey.current === key) setLoading(false);
      });
  }, [deck?.templateId, mappingKey, rows]);

  const handleRefresh = async () => {
    if (!deck || !gameData || !deckId) return;
    setRefreshing(true);
    try {
      const csvUrl = buildTabCsvUrl(gameData.game.sheetUrl, deck.sheetTabGid);
      const data = await fetchSheetData(csvUrl);
      setDeckData(deckId, data.headers, data.rows);
      setDeckCardImages(deckId, [], '');
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  if (deckLoading || !deck) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading deck...</p>;
  }

  // Card labels
  const firstMappedColumn = deck
    ? Object.entries(deck.mapping).find(([k, v]) => k !== '_cardId' && v)?.[1]
    : undefined;
  const labelColumn = firstMappedColumn || headers[0];
  const baseLabels = rows.map((row) => (labelColumn ? row[labelColumn] || '' : ''));

  const cardIdColumn = deck?.mapping._cardId;
  const cardIds = cardIdColumn
    ? rows.map((row) => row[cardIdColumn] || '')
    : undefined;

  // Card back handling
  const hasCardBack = !!deck.cardBackImage;
  const displayImages = hasCardBack && cardImages.length > 0
    ? [`/api/games/${gameId}/images/thumb/artwork/cardback/${deck.cardBackImage}?w=${deckDims.widthCss}&h=${deckDims.heightCss}`, ...cardImages]
    : cardImages;
  const cardLabels = hasCardBack && cardImages.length > 0
    ? ['Card Back', ...baseLabels]
    : baseLabels;

  const zoomOptions = [
    { value: 160 as const, label: 'S' },
    { value: 240 as const, label: 'M' },
    { value: 360 as const, label: 'L' },
  ];

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-5)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-1)' }}>
            <h1 style={{ fontSize: 26 }}>{deck.name}</h1>
            <button
              className="secondary sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              title="Refresh data from Google Sheet"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Sheet: {deck.sheetTabName} &middot; Template:{' '}
            <Link to={`/templates/${deck.templateId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{templateName}</Link>
            {' '}&middot; {deckDims.widthInches}" x {deckDims.heightInches}"{deck.landscape ? ' (Landscape)' : ''}
            {deck.cardBackImage && <> &middot; Card Back: {deck.cardBackImage}</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button
            className="secondary"
            onClick={() => navigate(`/games/${gameId}/decks/${deckId}/edit`)}
          >
            Edit
          </button>
          {cardImages.length > 0 && (
            <button className="primary" onClick={() => setShowExport(true)}>
              Export
            </button>
          )}
          <button
            className="danger"
            onClick={() => {
              if (!confirm(`Delete deck "${deck.name}"? This cannot be undone.`)) return;
              deleteDeck.mutate(deck.id, {
                onSuccess: () => navigate(`/games/${gameId}`),
              });
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        <button
          className={activeTab === 'cards' ? 'active' : ''}
          onClick={() => setActiveTab('cards')}
        >
          Cards {cardImages.length > 0 && `(${rows.length})`}
        </button>
        <button
          className={activeTab === 'data' ? 'active' : ''}
          onClick={() => setActiveTab('data')}
        >
          Data {rows.length > 0 && `(${rows.length})`}
        </button>
      </div>

      {activeTab === 'cards' && (
        <>
          {loading && (
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }}>
              {rows.length > 0 ? `Rendering ${rows.length} cards...` : 'Loading sheet data...'}
            </p>
          )}

          {!loading && cardImages.length > 0 && (
            <>
              <div className="card-grid-toolbar">
                <div className="zoom-presets">
                  {zoomOptions.map((opt) => (
                    <button
                      key={opt.value}
                      className={cardZoom === opt.value ? 'active' : ''}
                      onClick={() => setCardZoom(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

              </div>

              <CardGrid
                cardImages={displayImages}
                cardLabels={cardLabels}
                cardIds={cardIds}
                rawLabelCount={hasCardBack ? 1 : 0}
                cardZoom={cardZoom}
              />
            </>
          )}

          {!loading && cardImages.length === 0 && rows.length > 0 && (
            <div style={{ textAlign: 'center', padding: '60px var(--sp-5)', color: 'var(--text-muted)' }}>
              <p>Card rendering did not complete. Click Refresh to try again.</p>
            </div>
          )}

          {!loading && cardImages.length === 0 && rows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px var(--sp-5)', color: 'var(--text-muted)' }}>
              <p>No card data loaded. Click Refresh to load from the sheet.</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'data' && (
        <>
          {rows.length > 0 ? (
            <DataTable
              headers={headers}
              rows={rows}
              highlightedColumns={Object.values(deck.mapping).filter(Boolean) as string[]}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '60px var(--sp-5)', color: 'var(--text-muted)' }}>
              <p>No data loaded yet. Click Refresh to load from the sheet.</p>
            </div>
          )}
        </>
      )}

      {showExport && (
        <ExportModal
          open={showExport}
          onClose={() => setShowExport(false)}
          deckId={deckId}
          rows={rows}
          templateId={deck.templateId}
          mapping={deck.mapping}
          cardBackImage={deck.cardBackImage}
          gameId={gameId}
          cardSizePreset={deck.cardSizePreset}
          cardWidthInches={deck.cardWidthInches}
          cardHeightInches={deck.cardHeightInches}
          landscape={deck.landscape}
        />
      )}
    </div>
  );
}
