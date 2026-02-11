import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTemplate } from '../api/client';

type TabName = 'manifest' | 'html' | 'css';

export default function TemplateView() {
  const { templateId } = useParams<{ templateId: string }>();
  const [activeTab, setActiveTab] = useState<TabName>('manifest');

  const { data, isLoading } = useQuery({
    queryKey: ['template-detail', templateId],
    queryFn: () => fetchTemplate(templateId!),
    enabled: !!templateId,
  });

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

  if (isLoading) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading template...</p>;
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 'var(--sp-3)' }}>
        {data?.template?.name ?? 'Template'}
      </h1>
      {data?.template && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 'var(--sp-4)' }}>
          {data.template.description} &middot; {data.template.width}&quot; x {data.template.height}&quot; &middot;{' '}
          {data.template.fields.length} fields, {data.template.imageSlots.length} image slots
        </p>
      )}

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
  );
}
