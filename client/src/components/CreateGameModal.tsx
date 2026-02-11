import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateGame } from '../hooks/useGames';

interface CreateGameModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateGameModal({ open, onClose }: CreateGameModalProps) {
  const navigate = useNavigate();
  const createGame = useCreateGame();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async () => {
    if (!title.trim() || !sheetUrl.trim()) {
      setError('Title and Google Sheet URL are required');
      return;
    }
    setError('');
    try {
      const game = await createGame.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        sheetUrl: sheetUrl.trim(),
      });
      setTitle('');
      setDescription('');
      setSheetUrl('');
      onClose();
      navigate(`/games/${game.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel" style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>New Game</h2>
          <button
            className="secondary"
            onClick={onClose}
            style={{ padding: 'var(--sp-1) 10px', fontSize: 13 }}
          >
            Close
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 'var(--sp-1)' }}>
              Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Card Game"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 'var(--sp-1)' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 'var(--sp-1)' }}>
              Google Sheet URL *
            </label>
            <input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
              Must be published to the web (File &rarr; Share &rarr; Publish to web)
            </div>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--error)', fontSize: 13 }}>{error}</div>
        )}

        <button
          className="primary"
          onClick={handleSubmit}
          disabled={createGame.isPending}
          style={{ alignSelf: 'flex-start' }}
        >
          {createGame.isPending ? 'Creating...' : 'Create Game'}
        </button>
      </div>
    </div>
  );
}
