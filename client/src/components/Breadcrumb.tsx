import { Link, useLocation, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Game, Deck } from '@cardmaker/shared';

export default function Breadcrumb() {
  const location = useLocation();
  const params = useParams();
  const queryClient = useQueryClient();

  const crumbs: { label: string; to?: string }[] = [];
  const path = location.pathname;

  if (path === '/') {
    return null; // No breadcrumb on home
  }

  if (path.startsWith('/games')) {
    crumbs.push({ label: 'Games', to: '/' });

    if (params.id) {
      const gameData = queryClient.getQueryData<{ game: Game; decks: Deck[] }>(['game', params.id]);
      const gameTitle = gameData?.game.title ?? 'Game';

      if (params.deckId || path.endsWith('/decks/new')) {
        crumbs.push({ label: gameTitle, to: `/games/${params.id}` });

        if (path.endsWith('/decks/new')) {
          crumbs.push({ label: 'New Deck' });
        } else if (params.deckId) {
          const isEdit = path.endsWith('/edit');
          const deck = gameData?.decks.find((d) => d.id === params.deckId);
          const deckName = deck?.name ?? 'Deck';

          if (isEdit) {
            crumbs.push({ label: deckName, to: `/games/${params.id}/decks/${params.deckId}` });
            crumbs.push({ label: 'Edit' });
          } else {
            crumbs.push({ label: deckName });
          }
        }
      } else {
        crumbs.push({ label: gameTitle });
      }
    }
  } else if (path.startsWith('/templates')) {
    crumbs.push({ label: 'Templates', to: '/templates' });

    if (params.templateId) {
      if (params.templateId === 'new') {
        crumbs.push({ label: 'New Template' });
      } else {
        const templateData = queryClient.getQueryData<{ template: { name: string } }>(['template-detail', params.templateId]);
        crumbs.push({ label: templateData?.template.name ?? params.templateId });
      }
    }
  }

  if (crumbs.length === 0) return null;

  return (
    <nav className="breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          {i > 0 && <span className="breadcrumb-sep">/</span>}
          {crumb.to ? (
            <Link to={crumb.to}>{crumb.label}</Link>
          ) : (
            <span className="breadcrumb-current">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
