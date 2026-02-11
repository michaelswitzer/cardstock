import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useGame, useDeleteGame, useUpdateGame } from '../hooks/useGames';
import { useDeleteDeck } from '../hooks/useDecks';
import { fetchImages } from '../api/client';
import CreateDeckModal from '../components/CreateDeckModal';
import ExportModal from '../components/ExportModal';
import type { Deck } from '@cardmaker/shared';

export default function GameView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useGame(id);
  const deleteGame = useDeleteGame();
  const updateGame = useUpdateGame();
  const deleteDeck = useDeleteDeck();

  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSheetUrl, setEditSheetUrl] = useState('');
  const [editCoverImage, setEditCoverImage] = useState('');
  const { data: imageData } = useQuery({
    queryKey: ['images'],
    queryFn: fetchImages,
    enabled: editing,
  });

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
      description: editDescription || undefined,
      coverImage: editCoverImage || undefined,
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
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 'var(--sp-1)' }}>
                  Cover Image
                </label>
                <select
                  value={editCoverImage}
                  onChange={(e) => setEditCoverImage(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">None</option>
                  {imageData?.images.map((img) => (
                    <option key={img} value={img}>{img}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 'var(--sp-1)' }}>
                  Google Sheet URL
                </label>
                <input
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
            <>
              <h1 style={{ fontSize: 26, marginBottom: 'var(--sp-1)' }}>{game.title}</h1>
              {game.description && (
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>{game.description}</p>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {decks.length} deck{decks.length !== 1 ? 's' : ''} &middot;{' '}
                <span title={game.sheetUrl} style={{ cursor: 'help' }}>Sheet linked</span>
              </p>
            </>
          )}
        </div>
        {!editing && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button className="secondary" onClick={startEditing}>Edit</button>
            {decks.length > 0 && (
              <button className="primary" onClick={() => setShowExport(true)}>
                Export All Decks
              </button>
            )}
            <button className="danger" onClick={handleDeleteGame}>Delete Game</button>
          </div>
        )}
      </div>

      {/* Deck list */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
        <h2>Decks</h2>
        <button className="primary" onClick={() => { setEditingDeck(null); setShowCreateDeck(true); }}>
          New Deck
        </button>
      </div>

      {decks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px var(--sp-5)', color: 'var(--text-muted)' }}>
          <p>No decks yet. Create a deck to link a sheet tab with a template.</p>
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
                  src={`/api/images/thumb/cardback/${deck.cardBackImage}?w=72&h=100`}
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
                  Tab: {deck.sheetTabName} &middot; Template: {deck.templateId}
                </div>
              </Link>
              <button
                className="secondary"
                style={{ padding: 'var(--sp-1) var(--sp-2)', fontSize: 12 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingDeck(deck);
                  setShowCreateDeck(true);
                }}
              >
                Edit
              </button>
              <button
                className="danger"
                style={{ padding: 'var(--sp-1) var(--sp-2)', fontSize: 12 }}
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

      <CreateDeckModal
        open={showCreateDeck}
        onClose={() => { setShowCreateDeck(false); setEditingDeck(null); }}
        gameId={game.id}
        sheetUrl={game.sheetUrl}
        existingDeck={editingDeck}
      />

      {showExport && (
        <ExportModal
          open={showExport}
          onClose={() => setShowExport(false)}
          gameId={game.id}
        />
      )}
    </div>
  );
}
