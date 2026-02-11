import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import GamesInventory from './pages/GamesInventory';
import GameView from './pages/GameView';
import DeckView from './pages/DeckView';
import TemplateList from './pages/TemplateList';
import TemplateView from './pages/TemplateView';

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<GamesInventory />} />
          <Route path="/games/:id" element={<GameView />} />
          <Route path="/games/:id/decks/:deckId" element={<DeckView />} />
          <Route path="/templates" element={<TemplateList />} />
          <Route path="/templates/:templateId" element={<TemplateView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
