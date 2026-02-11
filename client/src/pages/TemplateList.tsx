import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTemplates } from '../api/client';
import { useDeleteTemplate } from '../hooks/useTemplates';

export default function TemplateList() {
  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });
  const navigate = useNavigate();
  const deleteMutation = useDeleteTemplate();
  const templates = data?.templates ?? [];

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
        <h1 style={{ fontSize: 26, flex: 1 }}>Templates</h1>
        <button className="primary" onClick={() => navigate('/templates/new')}>
          New Template
        </button>
      </div>

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
            <div style={{ display: 'flex', gap: 'var(--sp-2)', flexShrink: 0 }}>
              <button
                className="secondary"
                style={{ padding: 'var(--sp-1) var(--sp-2)', fontSize: 12 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/templates/${t.id}?edit=1`);
                }}
              >
                Edit
              </button>
              <button
                className="danger"
                style={{ padding: 'var(--sp-1) var(--sp-2)', fontSize: 12 }}
                onClick={(e) => handleDelete(e, t.id, t.name)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && !isLoading && (
        <p style={{ color: 'var(--text-muted)' }}>
          No templates found. Click "New Template" to create one.
        </p>
      )}
    </div>
  );
}
