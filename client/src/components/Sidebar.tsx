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
          `sidebar-item sidebar-game${isActive ? ' active' : ''}`
        }
      >
        {game.coverImage ? (
          <img
            src={`/api/games/${game.id}/images/thumb/${game.coverImage}?w=80&h=80`}
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
      {isRouteActive && decks && decks.length > 0 && (
        <div>
          {decks.map((deck) => (
            <NavLink
              key={deck.id}
              to={`/games/${game.id}/decks/${deck.id}`}
              className={({ isActive }) =>
                `sidebar-item sidebar-deck${isActive ? ' active' : ''}`
              }
              title={collapsed ? deck.name : undefined}
            >
              {deck.cardBackImage ? (
                <img
                  src={`/api/games/${game.id}/images/thumb/artwork/cardback/${deck.cardBackImage}?w=60&h=84`}
                  alt=""
                  className="sidebar-deck-thumb"
                />
              ) : (
                <div className="sidebar-deck-dot">{'\u{1F0A0}'}</div>
              )}
              <span className="sidebar-item-text">{deck.name}</span>
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
          <span className="sidebar-spade">♠</span>
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

      <div className={`sidebar-bottom${sidebarCollapsed ? ' collapsed' : ''}`}>
        <NavLink
          to="/templates"
          className={({ isActive }) =>
            `sidebar-utility-link${isActive ? ' active' : ''}`
          }
          title="Card Templates"
        >
          <svg className="sidebar-utility-icon" viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><rect x="1" y="2" width="6" height="8" rx="0.5" strokeWidth="0"/><rect x="5" y="5" width="6" height="8" rx="0.5" opacity="0.5"/><rect x="9" y="2" width="6" height="8" rx="0.5" strokeWidth="0"/></svg>
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
