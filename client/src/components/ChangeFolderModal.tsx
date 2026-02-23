import { useState } from 'react';

interface ChangeFolderModalProps {
  open: boolean;
  onClose: () => void;
  currentFolder: string | null;
}

export default function ChangeFolderModal({ open, onClose, currentFolder }: ChangeFolderModalProps) {
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  if (!open) return null;

  const displayPath = newFolder ?? currentFolder ?? 'Unknown';
  const hasChanged = newFolder !== null && newFolder !== currentFolder;

  const handleBrowse = async () => {
    if (!window.cardstock) return;
    const chosen = await window.cardstock.pickDataFolder();
    if (chosen) {
      setNewFolder(chosen);
    }
  };

  const handleConfirm = async () => {
    if (!window.cardstock || !newFolder) return;
    setRestarting(true);
    await window.cardstock.useDataFolder(newFolder);
    await window.cardstock.restartApp();
  };

  const handleClose = () => {
    setNewFolder(null);
    setRestarting(false);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="modal-panel" style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Change Data Folder</h2>
          <button className="secondary sm" onClick={handleClose}>Close</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div>
            <label className="form-label">{hasChanged ? 'New folder' : 'Current folder'}</label>
            <div
              style={{
                background: 'var(--bg-input, #12121e)',
                border: '1px solid var(--border, #2a2a40)',
                borderRadius: 6,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--text-secondary, #ccc)',
                wordBreak: 'break-all',
                lineHeight: 1.4,
              }}
            >
              {displayPath}
            </div>
          </div>

          <button className="secondary" onClick={handleBrowse} style={{ alignSelf: 'flex-start' }}>
            Browse...
          </button>

          {hasChanged && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -4 }}>
              The app will reload to apply the new data folder.
            </div>
          )}
        </div>

        <button
          className="primary"
          onClick={handleConfirm}
          disabled={!hasChanged || restarting}
          style={{ alignSelf: 'flex-start' }}
        >
          {restarting ? 'Reloading...' : 'Confirm and Reload'}
        </button>
      </div>
    </div>
  );
}
