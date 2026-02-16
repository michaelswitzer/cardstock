import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Breadcrumb from './components/Breadcrumb';
import WindowControls from './components/WindowControls';
import GamesInventory from './pages/GamesInventory';
import GameView from './pages/GameView';
import DeckView from './pages/DeckView';
import DeckEditor from './pages/DeckEditor';
import TemplateList from './pages/TemplateList';
import TemplateView from './pages/TemplateView';

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <WindowControls />
        <Breadcrumb />
        <Routes>
          <Route path="/" element={<GamesInventory />} />
          <Route path="/games/:id" element={<GameView />} />
          <Route path="/games/:id/decks/new" element={<DeckEditor />} />
          <Route path="/games/:id/decks/:deckId" element={<DeckView />} />
          <Route path="/games/:id/decks/:deckId/edit" element={<DeckEditor />} />
          <Route path="/templates" element={<TemplateList />} />
          <Route path="/templates/:templateId" element={<TemplateView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
