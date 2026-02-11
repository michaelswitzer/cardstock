import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useGames } from '../hooks/useGames';
import { useDecks } from '../hooks/useDecks';
import { fetchTemplates } from '../api/client';
import CreateGameModal from './CreateGameModal';
import type { Game } from '@cardmaker/shared';

function SidebarGame({ game, isRouteActive }: { game: Game; isRouteActive: boolean }) {
  const { data: decks } = useDecks(isRouteActive ? game.id : undefined);

  return (
    <div>
      <NavLink
        to={`/games/${game.id}`}
        end
        className={({ isActive }) =>
          `sidebar-item${isActive ? ' active' : ''}`
        }
      >
        {game.title}
      </NavLink>
      {isRouteActive && decks && decks.length > 0 && (
        <div>
          {decks.map((deck) => (
            <NavLink
              key={deck.id}
              to={`/games/${game.id}/decks/${deck.id}`}
              className={({ isActive }) =>
                `sidebar-item sidebar-deck${isActive ? ' active' : ''}`
              }
            >
              {deck.name}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const gameMatch = location.pathname.match(/^\/games\/([^/]+)/);
  const activeGameId = gameMatch?.[1];
  const { data: games } = useGames();
  const { data: templateData } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });
  const templates = templateData?.templates ?? [];
  const [showCreateGame, setShowCreateGame] = useState(false);

  return (
    <nav className="sidebar">
      <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="sidebar-title">
          Cardstock <span style={{ color: 'var(--primary)' }}>{'\u{1F0CF}'}</span>
        </div>
      </NavLink>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <NavLink to="/" className="sidebar-section-link"><h3>Games</h3></NavLink>
          <button
            className="sidebar-add-btn"
            onClick={() => setShowCreateGame(true)}
            title="New Game"
          >
            +
          </button>
        </div>

        {games?.map((game) => (
          <SidebarGame
            key={game.id}
            game={game}
            isRouteActive={activeGameId === game.id}
          />
        ))}

        {games?.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 'var(--sp-2) var(--sp-3)' }}>
            No games yet
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <NavLink to="/templates" className="sidebar-section-link"><h3>Templates</h3></NavLink>
        </div>
        {templates.map((t) => (
          <NavLink
            key={t.id}
            to={`/templates/${t.id}`}
            className={({ isActive }) =>
              `sidebar-item${isActive ? ' active' : ''}`
            }
          >
            {t.name}
          </NavLink>
        ))}
        {templates.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 'var(--sp-2) var(--sp-3)' }}>
            No templates
          </div>
        )}
      </div>

      <CreateGameModal
        open={showCreateGame}
        onClose={() => setShowCreateGame(false)}
      />
    </nav>
  );
}
