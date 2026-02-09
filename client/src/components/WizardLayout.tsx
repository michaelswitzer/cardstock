import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Step {
  path: string;
  label: string;
}

interface WizardLayoutProps {
  steps: Step[];
  children: ReactNode;
}

export default function WizardLayout({ steps, children }: WizardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentIndex = steps.findIndex((s) => s.path === location.pathname);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>CardMaker</h1>
        <nav style={{ display: 'flex', gap: 4 }}>
          {steps.map((step, i) => (
            <button
              key={step.path}
              onClick={() => navigate(step.path)}
              style={{
                padding: '10px 20px',
                background:
                  i === currentIndex
                    ? 'var(--primary)'
                    : i < currentIndex
                    ? 'var(--success)'
                    : 'var(--surface-light)',
                color: 'white',
                border: 'none',
                borderRadius:
                  i === 0
                    ? '8px 0 0 8px'
                    : i === steps.length - 1
                    ? '0 8px 8px 0'
                    : '0',
                cursor: 'pointer',
                fontWeight: i === currentIndex ? 700 : 400,
                opacity: i <= currentIndex ? 1 : 0.6,
              }}
            >
              {step.label}
            </button>
          ))}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
