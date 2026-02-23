import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTemplate, fetchImages, renderPreview } from '../api/client';
import { useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '../hooks/useTemplates';
import { useGames } from '../hooks/useGames';
import type { CardData, FieldMapping, TemplateField, ImageSlot } from '@cardmaker/shared';

type TabName = 'manifest' | 'html' | 'css' | 'preview';

const STARTER_MANIFEST = JSON.stringify(
  {
    name: 'New Template',
    description: '',
    fields: [],
    imageSlots: [],
  },
  null,
  2
);
const STARTER_HTML = '<div class="card">\n</div>';
const STARTER_CSS = '.card {\n  width: 250px;\n  height: 350px;\n}';

export default function TemplateView() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const isCreateMode = templateId === 'new';

  const [activeTab, setActiveTab] = useState<TabName>('manifest');
  const [editing, setEditing] = useState(isCreateMode || searchParams.get('edit') === '1');
  const [newId, setNewId] = useState('');
  const [editManifest, setEditManifest] = useState(STARTER_MANIFEST);
  const [editHtml, setEditHtml] = useState(STARTER_HTML);
  const [editCss, setEditCss] = useState(STARTER_CSS);

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['template-detail', templateId],
    queryFn: () => fetchTemplate(templateId!),
    enabled: !!templateId && !isCreateMode,
  });

  // Game selector for image slots in preview
  const [previewGameId, setPreviewGameId] = useState<string>('');
  const { data: gamesList } = useGames();
  const { data: imageData } = useQuery({
    queryKey: ['images', previewGameId],
    queryFn: () => fetchImages(previewGameId),
    enabled: !!previewGameId,
  });

  // Preview state
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewKey = useRef(0);

  // Initialize edit fields when entering edit mode on existing template
  useEffect(() => {
    if (!isCreateMode && data && editing) {
      setEditManifest(JSON.stringify(data.template, null, 2));
      setEditHtml(data.html);
      setEditCss(data.css);
    }
  }, [data, editing, isCreateMode]);

  // Initialize field values for preview
  useEffect(() => {
    if (!data?.template) return;
    const initial: Record<string, string> = {};
    for (const f of data.template.fields) {
      initial[f.name] = f.default ?? '';
    }
    for (const s of data.template.imageSlots) {
      initial[s.name] = '';
    }
    setFieldValues(initial);
  }, [data?.template]);

  // Render preview when field values change
  useEffect(() => {
    if (activeTab !== 'preview' || !templateId || isCreateMode || !data?.template) return;
    if (Object.values(fieldValues).every((v) => !v)) {
      setPreviewUrl(null);
      return;
    }

    const key = ++previewKey.current;
    setLoadingPreview(true);

    const mapping: FieldMapping = {};
    const cardData: CardData = {};
    for (const f of data.template.fields) {
      mapping[f.name] = f.name;
      cardData[f.name] = fieldValues[f.name] ?? '';
    }
    for (const s of data.template.imageSlots) {
      mapping[s.name] = s.name;
      cardData[s.name] = fieldValues[s.name] ?? '';
    }

    renderPreview(templateId, cardData, mapping, previewGameId || undefined)
      .then((dataUrl) => {
        if (previewKey.current === key) {
          setPreviewUrl(dataUrl);
          setLoadingPreview(false);
        }
      })
      .catch((err) => {
        console.error('Preview render failed:', err);
        if (previewKey.current === key) {
          setPreviewUrl(null);
          setLoadingPreview(false);
        }
      });
  }, [activeTab, fieldValues, templateId, data?.template, isCreateMode, previewGameId]);

  const tabs: { key: TabName; label: string }[] = [
    { key: 'manifest', label: 'Manifest' },
    { key: 'html', label: 'HTML' },
    { key: 'css', label: 'CSS' },
    ...(isCreateMode ? [] : [{ key: 'preview' as TabName, label: 'Preview' }]),
  ];

  const getContent = () => {
    if (!isCreateMode && (isLoading || !data)) return 'Loading...';
    switch (activeTab) {
      case 'manifest':
        return JSON.stringify(data?.template, null, 2);
      case 'html':
        return data?.html ?? '';
      case 'css':
        return data?.css ?? '';
      default:
        return '';
    }
  };

  const getEditValue = () => {
    switch (activeTab) {
      case 'manifest':
        return editManifest;
      case 'html':
        return editHtml;
      case 'css':
        return editCss;
      default:
        return '';
    }
  };

  const setEditValue = (value: string) => {
    switch (activeTab) {
      case 'manifest':
        setEditManifest(value);
        break;
      case 'html':
        setEditHtml(value);
        break;
      case 'css':
        setEditCss(value);
        break;
    }
  };

  const handleFieldChange = (name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setError('');
    if (isCreateMode) {
      if (!newId || !/^[a-zA-Z0-9_-]+$/.test(newId)) {
        setError('Template ID must be a URL-safe slug (letters, numbers, hyphens, underscores).');
        return;
      }
      try {
        await createMutation.mutateAsync({
          id: newId,
          manifest: editManifest,
          html: editHtml,
          css: editCss,
        });
        navigate(`/templates/${newId}`, { replace: true });
      } catch (err: any) {
        setError(err.response?.data?.error ?? 'Failed to create template');
      }
    } else {
      try {
        await updateMutation.mutateAsync({
          id: templateId!,
          manifest: editManifest,
          html: editHtml,
          css: editCss,
        });
        setEditing(false);
        setSearchParams({}, { replace: true });
        queryClient.invalidateQueries({ queryKey: ['template-detail', templateId] });
      } catch (err: any) {
        setError(err.response?.data?.error ?? 'Failed to update template');
      }
    }
  };

  const handleCancel = () => {
    if (isCreateMode) {
      navigate('/templates');
    } else {
      setEditing(false);
      setSearchParams({}, { replace: true });
      if (data) {
        setEditManifest(JSON.stringify(data.template, null, 2));
        setEditHtml(data.html);
        setEditCss(data.css);
      }
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete template "${data?.template?.name ?? templateId}"? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(templateId!);
      navigate('/templates', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to delete template');
    }
  };

  const handleEdit = () => {
    setEditing(true);
    setSearchParams({ edit: '1' }, { replace: true });
    if (data) {
      setEditManifest(JSON.stringify(data.template, null, 2));
      setEditHtml(data.html);
      setEditCss(data.css);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  if (!isCreateMode && isLoading) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading template...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
        <h1 style={{ fontSize: 26, flex: 1 }}>
          {isCreateMode ? 'New Template' : data?.template?.name ?? 'Template'}
        </h1>
        {!isCreateMode && !editing && (
          <>
            <button className="secondary" onClick={handleEdit}>
              Edit
            </button>
            <button className="danger" onClick={handleDelete}>
              Delete
            </button>
          </>
        )}
      </div>

      {!isCreateMode && data?.template && !editing && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 'var(--sp-4)' }}>
          {data.template.description} &middot;{' '}
          {data.template.fields.length} fields, {data.template.imageSlots.length} image slots
        </p>
      )}

      {error && (
        <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 'var(--sp-3)' }}>{error}</div>
      )}

      {/* ID input for create mode */}
      {isCreateMode && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label htmlFor="template-id" className="form-label">Template ID (directory slug)</label>
          <input
            id="template-id"
            type="text"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="e.g. my-template"
            style={{ width: '100%', maxWidth: 400 }}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? 'active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Code content */}
      {activeTab !== 'preview' && (
        editing ? (
          <textarea
            className="code-viewer"
            value={getEditValue()}
            onChange={(e) => setEditValue(e.target.value)}
            style={{
              maxHeight: 'none',
              minHeight: 300,
              width: '100%',
              resize: 'vertical',
              fontFamily: 'monospace',
              whiteSpace: 'pre',
              tabSize: 2,
            }}
            spellCheck={false}
          />
        ) : (
          <pre className="code-viewer" style={{ maxHeight: 'none' }}>{getContent()}</pre>
        )
      )}

      {/* Edit mode button bar */}
      {editing && activeTab !== 'preview' && (
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
          <button className="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isCreateMode ? 'Create Template' : 'Save Template'}
          </button>
          <button className="secondary" onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      )}

      {/* Preview tab */}
      {activeTab === 'preview' && !isCreateMode && data?.template && (
        <div style={{ display: 'flex', gap: 'var(--sp-5)' }}>
          {/* Left: field inputs */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {editing && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Preview renders the last saved version. Save your changes first to see them here.
              </p>
            )}
            {data.template.fields.map((f: TemplateField) => (
              <div key={f.name}>
                <label className="form-label">
                  {f.label}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    value={fieldValues[f.name] ?? ''}
                    onChange={(e) => handleFieldChange(f.name, e.target.value)}
                    rows={3}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={fieldValues[f.name] ?? ''}
                    onChange={(e) => handleFieldChange(f.name, e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            ))}
            {data.template.imageSlots.length > 0 && (
              <div>
                <label className="form-label">
                  Load artwork from
                </label>
                <select
                  value={previewGameId}
                  onChange={(e) => setPreviewGameId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Select a game...</option>
                  {gamesList?.map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>
            )}
            {data.template.imageSlots.map((s: ImageSlot) => (
              <div key={s.name}>
                <label className="form-label">
                  {s.label}
                </label>
                <select
                  value={fieldValues[s.name] ?? ''}
                  onChange={(e) => handleFieldChange(s.name, e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">None</option>
                  {imageData?.images
                    .filter((img) => img.startsWith('cardart/'))
                    .map((img) => {
                      const filename = img.split('/').pop()!;
                      return <option key={img} value={filename}>{filename}</option>;
                    })}
                </select>
              </div>
            ))}

            {/* Save/Cancel in preview tab too */}
            {editing && (
              <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
                <button className="primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
                <button className="secondary" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Right: card preview */}
          <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                aspectRatio: '250 / 350',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {loadingPreview && (
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Rendering...</span>
              )}
              {!loadingPreview && previewUrl && (
                <img
                  src={previewUrl}
                  alt="Card preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}
              {!loadingPreview && !previewUrl && (
                <span style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 'var(--sp-3)' }}>
                  Type in a field to see a preview
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
