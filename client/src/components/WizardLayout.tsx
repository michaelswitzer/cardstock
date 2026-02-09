import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Tab {
  path: string;
  label: string;
}

interface WizardLayoutProps {
  tabs: Tab[];
  children: ReactNode;
}

export default function WizardLayout({ tabs, children }: WizardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 24 }}>CardMaker</h1>
        </div>
        <nav style={{ display: 'flex', gap: 4 }}>
          {tabs.map((tab) => {
            const isActive = tab.path === location.pathname;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                style={{
                  padding: '10px 20px',
                  background: isActive ? 'var(--primary)' : 'var(--surface-light)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: isActive ? 700 : 400,
                  opacity: 1,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
