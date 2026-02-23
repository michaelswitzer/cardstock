import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useGame, useDeleteGame, useUpdateGame } from '../hooks/useGames';
import { useDeleteDeck } from '../hooks/useDecks';
import { fetchCovers, fetchTemplates, openGameFolder } from '../api/client';
import ExportModal from '../components/ExportModal';
import AssetBrowser from '../components/AssetBrowser';
import { CARD_SIZE_PRESETS } from '@cardmaker/shared';

export default function GameView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useGame(id);
  const deleteGame = useDeleteGame();
  const updateGame = useUpdateGame();
  const deleteDeck = useDeleteDeck();

  const [showExport, setShowExport] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSheetUrl, setEditSheetUrl] = useState('');
  const [editCoverImage, setEditCoverImage] = useState('');
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const { data: imageData } = useQuery({
    queryKey: ['covers', id],
    queryFn: () => fetchCovers(id!),
    enabled: editing && !!id,
  });
  const { data: templateData } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });
  const templateNames = new Map(templateData?.templates.map((t) => [t.id, t.name]) ?? []);

  if (isLoading || !data) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading game...</p>;
  }

  const { game, decks } = data;

  const handleDeleteGame = async () => {
    if (!confirm(`Delete "${game.title}" and all its decks?`)) return;
    await deleteGame.mutateAsync(game.id);
    navigate('/');
  };

  const handleDeleteDeck = async (deckId: string, deckName: string) => {
    if (!confirm(`Delete deck "${deckName}"?`)) return;
    await deleteDeck.mutateAsync(deckId);
  };

  const startEditing = () => {
    setEditTitle(game.title);
    setEditDescription(game.description ?? '');
    setEditSheetUrl(game.sheetUrl);
    setEditCoverImage(game.coverImage ?? '');
    setEditing(true);
  };

  const saveEditing = async () => {
    await updateGame.mutateAsync({
      id: game.id,
      title: editTitle,
      description: editDescription || '',
      coverImage: editCoverImage || '',
      sheetUrl: editSheetUrl,
    });
    setEditing(false);
  };

  return (
    <div>
      {/* Game header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-5)' }}>
        <div style={{ flex: 1 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{ fontSize: 22, fontWeight: 700, width: '100%' }}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                style={{ width: '100%' }}
              />
              <div>
                <label htmlFor="game-cover" className="form-label">Cover Image</label>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <select
                    id="game-cover"
                    value={editCoverImage}
                    onChange={(e) => setEditCoverImage(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">None</option>
                    {imageData?.images.map((img) => (
                      <option key={img} value={img}>{img}</option>
                    ))}
                  </select>
                  <button className="secondary sm" onClick={() => setShowAssetBrowser(true)}>
                    Browse
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="game-sheet-url" className="form-label">Google Sheet URL</label>
                <input
                  id="game-sheet-url"
                  value={editSheetUrl}
                  onChange={(e) => setEditSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button className="primary" onClick={saveEditing}>Save</button>
                <button className="secondary" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
              {game.coverImage && (
                <img
                  src={`/api/games/${game.id}/images/thumb/${game.coverImage}?w=120&h=120`}
                  alt={game.title}
                  style={{
                    borderRadius: 'var(--radius)',
                    flexShrink: 0,
                    objectFit: 'contain',
                  }}
                />
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-1)' }}>
                  <h1 style={{ fontSize: 26 }}>{game.title}</h1>
                  <button
                    className="secondary sm"
                    onClick={() => openGameFolder(game.id)}
                    title={navigator.platform.startsWith('Mac') ? 'Open in Finder' : 'Open in File Explorer'}
                  >
                    {navigator.platform.startsWith('Mac') ? 'Open in Finder' : 'Open in File Explorer'}
                  </button>
                </div>
                {game.description && (
                  <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>{game.description}</p>
                )}
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {decks.length} deck{decks.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
        {!editing && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button className="secondary" onClick={startEditing}>Edit</button>
            {decks.length > 0 && (
              <button className="primary" onClick={() => setShowExport(true)}>
                Export
              </button>
            )}
            <button className="danger" onClick={handleDeleteGame}>Delete</button>
          </div>
        )}
      </div>

      {/* Deck list */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
        <h2>Decks</h2>
        <button className="primary" onClick={() => navigate(`/games/${game.id}/decks/new`)}>
          New Deck
        </button>
      </div>

      {decks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px var(--sp-5)', color: 'var(--text-muted)' }}>
          <p>No decks yet. Create a deck to link a sheet with a template.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {decks.map((deck) => (
            <div
              key={deck.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              {deck.cardBackImage && (
                <img
                  src={`/api/games/${game.id}/images/thumb/artwork/cardback/${deck.cardBackImage}?w=72&h=100`}
                  alt="Card back"
                  style={{
                    width: 36,
                    height: 50,
                    objectFit: 'cover',
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                />
              )}
              <Link
                to={`/games/${game.id}/decks/${deck.id}`}
                style={{ flex: 1, textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontWeight: 600 }}>{deck.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Size:{' '}
                  {deck.cardSizePreset === 'custom'
                    ? `${deck.cardWidthInches ?? '?'}" × ${deck.cardHeightInches ?? '?'}"`
                    : (CARD_SIZE_PRESETS[deck.cardSizePreset as keyof typeof CARD_SIZE_PRESETS]?.label ?? 'Poker')
                  }
                  {deck.landscape ? ' (landscape)' : ''}
                  {' '}&middot; Sheet: {deck.sheetTabName} &middot; Template:{' '}
                  <a
                    href={`/templates/${deck.templateId}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/templates/${deck.templateId}`); }}
                    style={{ color: 'var(--primary)', textDecoration: 'none' }}
                  >{templateNames.get(deck.templateId) ?? deck.templateId}</a>
                </div>
              </Link>
              <button
                className="secondary sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/games/${game.id}/decks/${deck.id}/edit`);
                }}
              >
                Edit
              </button>
              <button
                className="danger sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteDeck(deck.id, deck.name);
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showExport && (
        <ExportModal
          open={showExport}
          onClose={() => setShowExport(false)}
          gameId={game.id}
        />
      )}

      {showAssetBrowser && id && (
        <AssetBrowser
          gameId={id}
          category="covers"
          onCategoryChange={() => {}}
          onSelect={(filename) => {
            setEditCoverImage(filename);
            setShowAssetBrowser(false);
          }}
          onClose={() => setShowAssetBrowser(false)}
          selectedValue={editCoverImage}
        />
      )}
    </div>
  );
}
