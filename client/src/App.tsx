import { Routes, Route, Navigate } from 'react-router-dom';
import WizardLayout from './components/WizardLayout';
import DataSourcePage from './pages/DataSourcePage';
import TemplateEditorPage from './pages/TemplateEditorPage';
import CardPreviewPage from './pages/CardPreviewPage';
import ExportPage from './pages/ExportPage';

const STEPS = [
  { path: '/data', label: '1. Data Source' },
  { path: '/template', label: '2. Template' },
  { path: '/preview', label: '3. Preview' },
  { path: '/export', label: '4. Export' },
];

export default function App() {
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
