import { useEffect, useState } from 'react';
import { getAppStatus, openRendererFolder, startHeartbeat, type RendererStatus } from '../api/client';

function formatSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * Sends the keep-alive heartbeat and shows the card renderer's state: download
 * progress on first launch (when no Chromium-based browser is installed), a
 * confirmation of where it was saved, or an error.
 */
export default function AppStatus() {
  const [status, setStatus] = useState<RendererStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => startHeartbeat(), []);

  useEffect(() => {
    let timer: number | undefined;
    const poll = async () => {
      try {
        const { renderer } = await getAppStatus();
        setStatus(renderer);
        if (renderer.state === 'ready') return;
      } catch {
        // server not reachable yet
      }
      timer = window.setTimeout(poll, 1000);
    };
    poll();
    return () => window.clearTimeout(timer);
  }, []);

  if (status?.state === 'downloading') {
    return (
      <div className="app-banner">
        <strong>Downloading the card renderer</strong> (one-time setup). Cardstock needs a Chromium
        browser engine to draw cards and none is installed, so it's downloading one
        {status.indeterminate ? ' — this can take a minute or two.' : ` — ${status.progress ?? 0}%`}
        {status.target && <div className="app-banner-path">Saving to {status.target}</div>}
        <div className={`app-banner-progress${status.indeterminate ? ' indeterminate' : ''}`}>
          <div style={status.indeterminate ? undefined : { width: `${status.progress ?? 0}%` }} />
        </div>
      </div>
    );
  }

  if (status?.state === 'ready' && status.downloaded && !dismissed) {
    return (
      <div className="app-banner success">
        <strong>Card renderer installed.</strong>{' '}
        {status.downloaded.nix ? (
          <>
            Chromium was fetched from nixpkgs and linked into Cardstock's folder, so it stays
            available (and safe from garbage collection) for future launches. To remove it, delete
            this link and run <code>nix-collect-garbage</code>:
          </>
        ) : (
          <>
            It was downloaded once ({formatSize(status.downloaded.bytes ?? 0)}) and will be reused every
            time Cardstock starts. To remove it, delete this folder:
          </>
        )}
        <div className="app-banner-path">{status.downloaded.path}</div>
        <div className="app-banner-actions">
          <button className="secondary sm" onClick={() => openRendererFolder().catch(() => {})}>
            Show Folder
          </button>
          <button className="primary sm" onClick={() => setDismissed(true)}>
            OK
          </button>
        </div>
      </div>
    );
  }

  if (status?.state === 'error') {
    return (
      <div className="app-banner error">
        <strong>Card rendering is unavailable.</strong> {status.error}
        <div style={{ marginTop: 'var(--sp-2)', color: 'var(--text-muted)' }}>
          Install Google Chrome, Microsoft Edge or Chromium, then restart Cardstock.
        </div>
      </div>
    );
  }

  return null;
}
