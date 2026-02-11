import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useDeck } from '../hooks/useDecks';
import { useGame } from '../hooks/useGames';
import { useAppStore } from '../stores/appStore';
import { useQuery } from '@tanstack/react-query';
import { fetchSheetData, renderPreviewBatch, fetchTemplates } from '../api/client';
import { buildTabCsvUrl } from '../api/sheetUtils';
import CardGrid from '../components/CardGrid';
import ExportModal from '../components/ExportModal';
import CreateDeckModal from '../components/CreateDeckModal';

export default function DeckView() {
  const { id: gameId, deckId } = useParams<{ id: string; deckId: string }>();
  const { data: deck, isLoading: deckLoading } = useDeck(deckId);
  const { data: gameData } = useGame(gameId);
  const { data: templateData } = useQuery({ queryKey: ['templates'], queryFn: fetchTemplates });
  const templateName = templateData?.templates.find((t) => t.id === deck?.templateId)?.name ?? deck?.templateId;
  const { deckDataCache, setDeckData, setDeckCardImages } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const renderKey = useRef<number>(0);

  const cache = deckId ? deckDataCache[deckId] : undefined;
  const headers = cache?.headers ?? [];
  const rows = cache?.rows ?? [];
  const cardImages = cache?.cardImages ?? [];
  const cardImagesKey = cache?.cardImagesKey ?? '';

  // Fetch sheet data and render cards when deck loads
  useEffect(() => {
    if (!deck || !gameData || !deckId) return;
    if (rows.length > 0) return; // Already have data cached

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

  // Render card images when data is available
  useEffect(() => {
    if (!deck || !deckId || rows.length === 0 || Object.keys(deck.mapping).length === 0) return;

    const inputsKey = JSON.stringify({ t: deck.templateId, m: deck.mapping, r: rows });
    if (cardImages.length > 0 && inputsKey === cardImagesKey) return;

    const key = ++renderKey.current;
    setLoading(true);

    renderPreviewBatch(deck.templateId, rows, deck.mapping)
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
  }, [deck?.templateId, deck?.mapping, rows]);

  const handleRefresh = async () => {
    if (!deck || !gameData || !deckId) return;
    setRefreshing(true);
    try {
      const csvUrl = buildTabCsvUrl(gameData.game.sheetUrl, deck.sheetTabGid);
      const data = await fetchSheetData(csvUrl);
      setDeckData(deckId, data.headers, data.rows);
      // Clear card images to force re-render
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

  // Use the first mapped column's value (excluding _cardId) as the card label
  const firstMappedColumn = deck
    ? Object.entries(deck.mapping).find(([k, v]) => k !== '_cardId' && v)?.[1]
    : undefined;
  const labelColumn = firstMappedColumn || headers[0];
  const baseLabels = rows.map((row) => (labelColumn ? row[labelColumn] || '' : ''));

  // Card IDs from the _cardId mapping
  const cardIdColumn = deck?.mapping._cardId;
  const cardIds = cardIdColumn
    ? rows.map((row) => row[cardIdColumn] || '')
    : undefined;

  // Prepend card back as the first card if one is set
  const hasCardBack = !!deck.cardBackImage;
  const displayImages = hasCardBack && cardImages.length > 0
    ? [`/artwork/cardback/${deck.cardBackImage}`, ...cardImages]
    : cardImages;
  const cardLabels = hasCardBack && cardImages.length > 0
    ? ['Card Back', ...baseLabels]
    : baseLabels;

  return (
    <div>
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
            onClick={() => setShowEdit(true)}
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

      {loading && (
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {rows.length > 0 ? `Rendering ${rows.length} cards...` : 'Loading sheet data...'}
        </p>
      )}

      {!loading && cardImages.length > 0 && (
        <CardGrid cardImages={displayImages} cardLabels={cardLabels} cardIds={cardIds} rawLabelCount={hasCardBack ? 1 : 0} />
      )}

      {!loading && cardImages.length === 0 && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px var(--sp-5)', color: 'var(--text-muted)' }}>
          <p>No card data loaded. Click Refresh to load from the sheet.</p>
        </div>
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
        />
      )}

      {showEdit && gameId && (
        <CreateDeckModal
          open={showEdit}
          onClose={() => setShowEdit(false)}
          gameId={gameId}
          sheetUrl={gameData?.game.sheetUrl ?? ''}
          existingDeck={deck}
        />
      )}
    </div>
  );
}
