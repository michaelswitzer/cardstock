import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGames } from '../hooks/useGames';
import CreateGameModal from '../components/CreateGameModal';
import ChangeFolderModal from '../components/ChangeFolderModal';

declare global {
  interface Window {
    cardstock?: {
      getDataFolder: () => Promise<string>;
      getDefaultDataFolder: () => Promise<string>;
      pickDataFolder: () => Promise<string | null>;
      useDataFolder: (folderPath: string) => Promise<string>;
      welcomeDone: (folderPath: string) => Promise<void>;
      restartApp: () => Promise<void>;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
    };
  }
}

function hashTitle(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateGradient(title: string): string {
  const h = hashTitle(title);
  const hue1 = (h % 360);
  const hue2 = (hue1 + 40 + (h % 30)) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 45%, 25%) 0%, hsl(${hue2}, 40%, 18%) 100%)`;
}

export default function GamesInventory() {
  const { data: games, isLoading } = useGames();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showChangeFolder, setShowChangeFolder] = useState(false);
  const [dataFolder, setDataFolder] = useState<string | null>(null);
  const isElectron = !!window.cardstock;

  useEffect(() => {
    if (window.cardstock) {
      window.cardstock.getDataFolder().then(setDataFolder);
    }
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
        <h1 style={{ fontSize: 26 }}>Games</h1>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          {isElectron && (
            <button className="secondary" onClick={() => setShowChangeFolder(true)} title={dataFolder ?? undefined}>
              Change Data Folder
            </button>
          )}
          <button className="primary" onClick={() => setShowCreate(true)}>
            New Game
          </button>
        </div>
      </div>

      {isLoading && (
        <p style={{ color: 'var(--text-muted)' }}>Loading games...</p>
      )}

      {!isLoading && games?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px var(--sp-5)' }}>
          <h3 style={{ marginBottom: 'var(--sp-2)' }}>No games yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-5)' }}>
            Create a game to get started. Each game links to a Google Sheets document with multiple sheets for different decks.
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
            {game.deckCount > 0 && (
              <div className="game-tile-badge">
                {game.deckCount} {game.deckCount === 1 ? 'deck' : 'decks'}
              </div>
            )}

            {game.coverImage ? (
              <img
                src={`/api/games/${game.id}/images/thumb/${game.coverImage}?w=300&h=200`}
                alt={game.title}
                className="game-tile-cover"
              />
            ) : (
              <div
                className="game-tile-gradient"
                style={{ background: generateGradient(game.title) }}
              >
                {game.title.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="game-tile-title">{game.title}</div>
            {game.description && (
              <div className="game-tile-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {game.description}
              </div>
            )}

            {/* Hover overlay with quick actions */}
            <div className="game-tile-overlay" onClick={(e) => e.stopPropagation()}>
              <button className="primary sm" onClick={() => navigate(`/games/${game.id}`)}>
                Open
              </button>
              {game.deckCount > 0 && (
                <button className="secondary sm" onClick={() => navigate(`/games/${game.id}`)}>
                  Export
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <CreateGameModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      <ChangeFolderModal
        open={showChangeFolder}
        onClose={() => setShowChangeFolder(false)}
        currentFolder={dataFolder}
      />
    </div>
  );
}
