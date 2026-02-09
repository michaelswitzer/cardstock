import type { CardTemplate } from '@cardmaker/shared';
import { useAppStore } from '../stores/appStore';

interface FieldMapperProps {
  template: CardTemplate;
  sheetHeaders: string[];
}

export default function FieldMapper({ template, sheetHeaders }: FieldMapperProps) {
  const { mapping, setFieldMapping } = useAppStore();
  const allSlots = [
    ...template.fields.map((f) => ({ name: f.name, label: f.label, kind: 'field' as const })),
    ...template.imageSlots.map((s) => ({ name: s.name, label: s.label, kind: 'image' as const })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>Map Fields</h3>
      {allSlots.map((slot) => (
        <div
          key={slot.name}
          style={{ display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <label
            style={{
              width: 140,
              fontSize: 13,
              color: slot.kind === 'image' ? 'var(--warning)' : 'var(--text)',
            }}
          >
            {slot.kind === 'image' ? '[IMG] ' : ''}
            {slot.label}
          </label>
          <select
            value={mapping[slot.name] ?? ''}
            onChange={(e) => setFieldMapping(slot.name, e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">-- unmapped --</option>
            {sheetHeaders.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
