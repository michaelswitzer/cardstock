import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useDefaults, useSaveDefaults } from '../hooks/useDefaults';
import type { LocalDefaults } from '@cardmaker/shared';

interface ClearDefaultButtonProps {
  target: 'dataSource' | 'template';
}

export default function ClearDefaultButton({ target }: ClearDefaultButtonProps) {
  const { selectedTemplate } = useAppStore();
  const { data: defaults } = useDefaults();
  const saveMutation = useSaveDefaults();
  const [showCleared, setShowCleared] = useState(false);

  const hasDefault =
    target === 'dataSource'
      ? !!defaults?.sheetUrl
      : !!defaults?.defaultTemplateId;

  if (!hasDefault) return null;

  const handleClear = () => {
    const updated: LocalDefaults = { ...defaults, version: 1 };

    if (target === 'dataSource') {
      delete updated.sheetUrl;
    } else {
      delete updated.defaultTemplateId;
      if (selectedTemplate && updated.mappings) {
        const { [selectedTemplate.id]: _, ...rest } = updated.mappings;
        updated.mappings = Object.keys(rest).length > 0 ? rest : undefined;
      }
    }

    saveMutation.mutate(updated, {
      onSuccess: () => {
        setShowCleared(true);
        setTimeout(() => setShowCleared(false), 2000);
      },
    });
  };

  return (
    <button
      className="secondary"
      onClick={handleClear}
      disabled={saveMutation.isPending}
      style={{ fontSize: 13, padding: '6px 14px' }}
    >
      {showCleared ? 'Cleared!' : saveMutation.isPending ? 'Clearing...' : 'Clear Default'}
    </button>
  );
}
