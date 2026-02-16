import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useGames } from '../hooks/useGames';
import { useDecks } from '../hooks/useDecks';
import { fetchTemplates } from '../api/client';
import { useAppStore } from '../stores/appStore';
import CreateGameModal from './CreateGameModal';
import type { Game } from '@cardmaker/shared';

function SidebarGame({ game, isRouteActive, collapsed }: { game: Game; isRouteActive: boolean; collapsed: boolean }) {
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
        {game.coverImage ? (
          <img
            src={`/api/games/${game.id}/images/thumb/${game.coverImage}?w=40&h=40`}
            alt=""
            className="sidebar-game-thumb"
          />
        ) : (
          <div className="sidebar-game-dot">
            {game.title.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="sidebar-item-text">{game.title}</span>
      </NavLink>
      {!collapsed && isRouteActive && decks && decks.length > 0 && (
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
  const navigate = useNavigate();
  const { data: templateData } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });
  const templates = templateData?.templates ?? [];
  const [showCreateGame, setShowCreateGame] = useState(false);
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();

  return (
    <nav className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-title">
        <span style={{ color: 'var(--primary)' }}>{'\u{1F0CF}'}</span>
        <span className="sidebar-title-text">Cardstock</span>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <NavLink to="/" className="sidebar-section-link"><h3>{'\u{2660}'} Games</h3></NavLink>
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
            collapsed={sidebarCollapsed}
          />
        ))}

        {games?.length === 0 && (
          <div className="sidebar-empty" style={{ fontSize: 12, color: 'var(--text-muted)', padding: 'var(--sp-2) var(--sp-3)' }}>
            No games yet
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <NavLink to="/templates" className="sidebar-section-link"><h3>{'\u{2727}'} Templates</h3></NavLink>
          <button
            className="sidebar-add-btn"
            onClick={() => navigate('/templates/new')}
            title="New Template"
          >
            +
          </button>
        </div>
        {templates.map((t) => (
          <NavLink
            key={t.id}
            to={`/templates/${t.id}`}
            className={({ isActive }) =>
              `sidebar-item${isActive ? ' active' : ''}`
            }
          >
            <span className="sidebar-item-text">{t.name}</span>
          </NavLink>
        ))}
        {templates.length === 0 && (
          <div className="sidebar-empty" style={{ fontSize: 12, color: 'var(--text-muted)', padding: 'var(--sp-2) var(--sp-3)' }}>
            No templates
          </div>
        )}
      </div>

      <div className="sidebar-bottom">
        <button
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '\u{25B6}' : '\u{25C0}'}
        </button>
      </div>

      <CreateGameModal
        open={showCreateGame}
        onClose={() => setShowCreateGame(false)}
      />
    </nav>
  );
}
