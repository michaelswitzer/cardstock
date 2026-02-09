import { Routes, Route, Navigate } from 'react-router-dom';
import WizardLayout from './components/WizardLayout';
import DataSourcePage from './pages/DataSourcePage';
import TemplateEditorPage from './pages/TemplateEditorPage';
import CardPreviewPage from './pages/CardPreviewPage';
import ExportPage from './pages/ExportPage';
import { useAutoStart } from './hooks/useAutoStart';

const STEPS = [
  { path: '/data', label: '1. Data Source' },
  { path: '/template', label: '2. Template' },
  { path: '/preview', label: '3. Preview' },
  { path: '/export', label: '4. Export' },
];

export default function App() {
  const { loading } = useAutoStart();

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>CardMaker</h1>
        <p style={{ color: 'var(--text-muted)' }}>Loading saved session...</p>
      </div>
    );
  }

  return (
    <WizardLayout steps={STEPS}>
      <Routes>
        <Route path="/data" element={<DataSourcePage />} />
        <Route path="/template" element={<TemplateEditorPage />} />
        <Route path="/preview" element={<CardPreviewPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="*" element={<Navigate to="/data" replace />} />
      </Routes>
    </WizardLayout>
  );
}
