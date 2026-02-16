import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDeck } from '../hooks/useDecks';
import { useGame } from '../hooks/useGames';
import { useAppStore } from '../stores/appStore';
import { useQuery } from '@tanstack/react-query';
import { fetchSheetData, renderPreviewBatch, fetchTemplates } from '../api/client';
import { buildTabCsvUrl } from '../api/sheetUtils';
import CardGrid from '../components/CardGrid';
import DataTable from '../components/DataTable';
import ExportModal from '../components/ExportModal';

type DeckTab = 'cards' | 'data';
type CardStatus = 'green' | 'yellow' | 'red';

export default function DeckView() {
  const { id: gameId, deckId } = useParams<{ id: string; deckId: string }>();
  const navigate = useNavigate();
  const { data: deck, isLoading: deckLoading } = useDeck(deckId);
  const { data: gameData } = useGame(gameId);
  const { data: templateData } = useQuery({ queryKey: ['templates'], queryFn: fetchTemplates });
  const template = templateData?.templates.find((t) => t.id === deck?.templateId);
  const templateName = template?.name ?? deck?.templateId;
  const { deckDataCache, setDeckData, setDeckCardImages, cardZoom, setCardZoom } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeTab, setActiveTab] = useState<DeckTab>('cards');
  const renderKey = useRef<number>(0);

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

    renderPreviewBatch(deck.templateId, rows, deck.mapping, gameId)
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
    ? [`/api/games/${gameId}/images/thumb/artwork/cardback/${deck.cardBackImage}?w=250&h=350`, ...cardImages]
    : cardImages;
  const cardLabels = hasCardBack && cardImages.length > 0
    ? ['Card Back', ...baseLabels]
    : baseLabels;

  // Card status computation
  const computeCardStatus = (): CardStatus[] | undefined => {
    if (!template || !deck || rows.length === 0) return undefined;
    const statuses: CardStatus[] = [];

    if (hasCardBack) {
      statuses.push('green');
    }

    for (const row of rows) {
      const hasAllFields = template.fields.every((f) => {
        const col = deck.mapping[f.name];
        return col && row[col];
      });
      const hasAllImages = template.imageSlots.every((s) => {
        const col = deck.mapping[s.name];
        return col && row[col];
      });

      if (hasAllFields && hasAllImages) {
        statuses.push('green');
      } else if (hasAllFields || hasAllImages) {
        statuses.push('yellow');
      } else {
        statuses.push('red');
      }
    }
    return statuses;
  };

  const cardStatus = cardImages.length > 0 ? computeCardStatus() : undefined;

  const zoomOptions = [
    { value: 160 as const, label: 'S' },
    { value: 240 as const, label: 'M' },
    { value: 360 as const, label: 'L' },
  ];

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 'var(--sp-1)' }}>{deck.name}</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Sheet: {deck.sheetTabName} &middot; Template: {templateName}
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
          <button
            className="secondary"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          {cardImages.length > 0 && (
            <button className="primary" onClick={() => setShowExport(true)}>
              Export
            </button>
          )}
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
                cardStatus={cardStatus}
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
        />
      )}
    </div>
  );
}
