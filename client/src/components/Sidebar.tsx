import { NavLink, useLocation } from 'react-router-dom';
import { useGames } from '../hooks/useGames';
import { useDecks } from '../hooks/useDecks';
import { useAppStore } from '../stores/appStore';
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
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();

  return (
    <nav className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-title">
        <NavLink to="/" className="sidebar-title-link">
          <span style={{ color: 'var(--primary)' }}>{'\u{1F0CF}'}</span>
          <span className="sidebar-title-text">Cardstock</span>
        </NavLink>
      </div>

      <div className="sidebar-game-list">
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

      <div className="sidebar-bottom">
        <NavLink
          to="/templates"
          className={({ isActive }) =>
            `sidebar-utility-link${isActive ? ' active' : ''}`
          }
        >
          <span className="sidebar-item-text">Card Templates</span>
        </NavLink>
        <button
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '\u{25B6}' : '\u{25C0}'}
        </button>
      </div>

    </nav>
  );
}
