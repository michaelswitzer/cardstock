import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTemplates } from '../api/client';

export default function TemplateList() {
  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });
  const navigate = useNavigate();
  const templates = data?.templates ?? [];

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 'var(--sp-5)' }}>Templates</h1>

      {isLoading && (
        <p style={{ color: 'var(--text-muted)' }}>Loading templates...</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {templates.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--sp-3) var(--sp-4)',
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/templates/${t.id}`)}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t.description} &middot; {t.width}&quot; x {t.height}&quot; &middot;{' '}
                {t.fields.length} fields, {t.imageSlots.length} image slots
              </div>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && !isLoading && (
        <p style={{ color: 'var(--text-muted)' }}>
          No templates found. Add template directories to server/templates/.
        </p>
      )}
    </div>
  );
}
