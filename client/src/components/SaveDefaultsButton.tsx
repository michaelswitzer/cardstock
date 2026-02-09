import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useDefaults, useSaveDefaults } from '../hooks/useDefaults';
import type { LocalDefaults } from '@cardmaker/shared';

export default function SaveDefaultsButton() {
  const { sheetUrl, selectedTemplate, mapping } = useAppStore();
  const { data: defaults } = useDefaults();
  const saveMutation = useSaveDefaults();
  const [showSaved, setShowSaved] = useState(false);

  if (!sheetUrl && !selectedTemplate) return null;

  const handleSave = () => {
    const updated: LocalDefaults = {
      ...defaults,
      version: 1,
    };

    if (sheetUrl) {
      updated.sheetUrl = sheetUrl;
    }

    if (selectedTemplate) {
      updated.defaultTemplateId = selectedTemplate.id;
      updated.mappings = {
        ...defaults?.mappings,
        [selectedTemplate.id]: mapping,
      };
    }

    saveMutation.mutate(updated, {
      onSuccess: () => {
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
      },
    });
  };

  return (
    <button
      className="secondary"
      onClick={handleSave}
      disabled={saveMutation.isPending}
      style={{ fontSize: 13, padding: '6px 14px' }}
    >
      {showSaved ? 'Saved!' : saveMutation.isPending ? 'Saving...' : 'Save as Defaults'}
    </button>
  );
}
