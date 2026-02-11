import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTemplate } from '../api/client';

interface TemplateViewerModalProps {
  templateId: string | null;
  onClose: () => void;
}

type TabName = 'manifest' | 'html' | 'css';

export default function TemplateViewerModal({ templateId, onClose }: TemplateViewerModalProps) {
  const [activeTab, setActiveTab] = useState<TabName>('manifest');

  const { data, isLoading } = useQuery({
    queryKey: ['template-detail', templateId],
    queryFn: () => fetchTemplate(templateId!),
    enabled: !!templateId,
  });

  if (!templateId) return null;

  const tabs: { key: TabName; label: string }[] = [
    { key: 'manifest', label: 'Manifest' },
    { key: 'html', label: 'HTML' },
    { key: 'css', label: 'CSS' },
  ];

  const getContent = () => {
    if (isLoading || !data) return 'Loading...';
    switch (activeTab) {
      case 'manifest':
        return JSON.stringify(data.template, null, 2);
      case 'html':
        return data.html;
      case 'css':
        return data.css;
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-panel"
        style={{ width: '100%', maxWidth: 700, maxHeight: '80vh' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{data?.template?.name ?? 'Template'}</h2>
          <button
            className="secondary"
            onClick={onClose}
            style={{ padding: 'var(--sp-1) 10px', fontSize: 13 }}
          >
            Close
          </button>
        </div>

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

        <pre className="code-viewer">{getContent()}</pre>
      </div>
    </div>
  );
}
