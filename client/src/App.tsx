import { Routes, Route, Navigate } from 'react-router-dom';
import WizardLayout from './components/WizardLayout';
import DataSourcePage from './pages/DataSourcePage';
import TemplateEditorPage from './pages/TemplateEditorPage';
import CardPreviewPage from './pages/CardPreviewPage';
import { useAutoStart } from './hooks/useAutoStart';

const TABS = [
  { path: '/preview', label: 'Cards' },
  { path: '/data', label: 'Data Source' },
  { path: '/template', label: 'Template' },
];

export default function App() {
  const { loading, startPath } = useAutoStart();

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>CardMaker</h1>
        <p style={{ color: 'var(--text-muted)' }}>Loading saved session...</p>
      </div>
    );
  }

  return (
    <WizardLayout tabs={TABS}>
      <Routes>
        <Route path="/data" element={<DataSourcePage />} />
        <Route path="/template" element={<TemplateEditorPage />} />
        <Route path="/preview" element={<CardPreviewPage />} />
        <Route path="*" element={<Navigate to={startPath} replace />} />
      </Routes>
    </WizardLayout>
  );
}
