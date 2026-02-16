import { useEffect } from 'react';

export default function WindowControls() {
  const isElectron = !!window.cardstock;

  useEffect(() => {
    if (isElectron) {
      document.body.classList.add('electron');
    }
    return () => {
      document.body.classList.remove('electron');
    };
  }, [isElectron]);

  if (!isElectron) return null;

  return (
    <>
      <div className="titlebar-drag-region" />
      <div className="window-controls">
        <button
          className="window-control-btn"
          onClick={() => window.cardstock!.minimizeWindow()}
          aria-label="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="window-control-btn"
          onClick={() => window.cardstock!.maximizeWindow()}
          aria-label="Maximize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="window-control-btn window-control-close"
          onClick={() => window.cardstock!.closeWindow()}
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </>
  );
}
