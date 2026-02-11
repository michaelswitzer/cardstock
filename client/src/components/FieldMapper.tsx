import type { CardTemplate, FieldMapping } from '@cardmaker/shared';

interface FieldMapperProps {
  template: CardTemplate;
  sheetHeaders: string[];
  mapping: FieldMapping;
  onFieldMappingChange: (templateField: string, sheetColumn: string) => void;
}

export default function FieldMapper({
  template,
  sheetHeaders,
  mapping,
  onFieldMappingChange,
}: FieldMapperProps) {
  const allSlots = [
    ...template.fields.map((f) => ({ name: f.name, label: f.label, kind: 'field' as const })),
    ...template.imageSlots.map((s) => ({ name: s.name, label: s.label, kind: 'image' as const })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      <h3 style={{ marginBottom: 'var(--sp-1)' }}>Map Fields</h3>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}
      >
        <label style={{ width: 140, fontSize: 13, color: 'var(--text)' }}>
          Card ID <span style={{ fontSize: 11 }}>(optional)</span>
        </label>
        <select
          value={mapping['_cardId'] ?? ''}
          onChange={(e) => onFieldMappingChange('_cardId', e.target.value)}
          style={{ flex: 1 }}
        >
          <option value="">-- use card number --</option>
          {sheetHeaders.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </div>
      {allSlots.map((slot) => (
        <div
          key={slot.name}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}
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
            onChange={(e) => onFieldMappingChange(slot.name, e.target.value)}
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
