import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGames } from '../hooks/useGames';
import CreateGameModal from '../components/CreateGameModal';

export default function GamesInventory() {
  const { data: games, isLoading } = useGames();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
        <h1 style={{ fontSize: 26 }}>Games</h1>
        <button className="primary" onClick={() => setShowCreate(true)}>
          New Game
        </button>
      </div>

      {isLoading && (
        <p style={{ color: 'var(--text-muted)' }}>Loading games...</p>
      )}

      {!isLoading && games?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px var(--sp-5)' }}>
          <h3 style={{ marginBottom: 'var(--sp-2)' }}>No games yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-5)' }}>
            Create a game to get started. Each game links to a Google Sheet with multiple tabs for different decks.
          </p>
          <button className="primary" onClick={() => setShowCreate(true)}>
            Create Your First Game
          </button>
        </div>
      )}

      <div className="game-grid">
        {games?.map((game) => (
          <div
            key={game.id}
            className="game-tile"
            onClick={() => navigate(`/games/${game.id}`)}
          >
            {game.coverImage ? (
              <img
                src={`/api/images/thumb/${game.coverImage}?w=300&h=200`}
                alt={game.title}
                className="game-tile-cover"
              />
            ) : (
              <div
                className="game-tile-cover"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  aspectRatio: '3 / 2',
                  background: 'var(--surface-light)',
                  fontSize: 32,
                  color: 'var(--text-muted)',
                }}
              >
                {'\u{1F0CF}'}
              </div>
            )}
            <div className="game-tile-title">{game.title}</div>
            <div className="game-tile-meta">
              {game.deckIds.length} deck{game.deckIds.length !== 1 ? 's' : ''}
            </div>
            {game.description && (
              <div className="game-tile-meta">{game.description}</div>
            )}
          </div>
        ))}
      </div>

      <CreateGameModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
