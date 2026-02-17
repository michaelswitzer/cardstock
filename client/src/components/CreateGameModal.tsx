import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateGame } from '../hooks/useGames';
import { uploadCoverImage } from '../api/client';

interface CreateGameModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateGameModal({ open, onClose }: CreateGameModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createGame = useCreateGame();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (coverFile) {
        await uploadCoverImage(game.id, coverFile);
        queryClient.invalidateQueries({ queryKey: ['games'] });
      }
      setTitle('');
      setDescription('');
      setSheetUrl('');
      setCoverFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      <div className="modal-panel" style={{ width: '100%', maxWidth: 600 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>New Game</h2>
          <button className="secondary sm" onClick={onClose}>Close</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div>
            <label htmlFor="game-title" className="form-label">Title *</label>
            <input
              id="game-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Card Game"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="game-desc" className="form-label">Description</label>
            <textarea
              id="game-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="game-sheet" className="form-label">Google Sheet URL *</label>
            <input
              id="game-sheet"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
              Must be published to the web (File &rarr; Share &rarr; Publish to web)
            </div>
          </div>

          <div>
            <label htmlFor="game-cover" className="form-label">Cover Image</label>
            <input
              ref={fileInputRef}
              id="game-cover"
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
              style={{ width: '100%' }}
            />
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
