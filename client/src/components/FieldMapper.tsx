import type { CardTemplate, CardData, FieldMapping } from '@cardmaker/shared';

interface FieldMapperProps {
  template: CardTemplate;
  sheetHeaders: string[];
  mapping: FieldMapping;
  onFieldMappingChange: (templateField: string, sheetColumn: string) => void;
  sampleRow?: CardData;
  onAutoMap?: () => void;
  onBrowseImage?: (slotName: string) => void;
}

export default function FieldMapper({
  template,
  sheetHeaders,
  mapping,
  onFieldMappingChange,
  sampleRow,
  onAutoMap,
  onBrowseImage,
}: FieldMapperProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
        <h3>Map Fields</h3>
        {onAutoMap && (
          <button className="secondary sm" onClick={onAutoMap}>
            Auto-Map
          </button>
        )}
      </div>

      {/* Card ID */}
      <div className="field-mapper-group">
        <div className="field-mapper-group-title">Identity</div>
        <div className="field-mapper-row">
          <div className="field-mapper-label">
            Card ID <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(optional)</span>
          </div>
          <div style={{ flex: 1 }}>
            <select
              value={mapping['_cardId'] ?? ''}
              onChange={(e) => onFieldMappingChange('_cardId', e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">-- use card number --</option>
              {sheetHeaders.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            {sampleRow && mapping['_cardId'] && (
              <div className="field-mapper-sample">
                {sampleRow[mapping['_cardId']] || '(empty)'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Text Fields */}
      {template.fields.length > 0 && (
        <div className="field-mapper-group">
          <div className="field-mapper-group-title">Text Fields</div>
          {template.fields.map((field) => (
            <div key={field.name} className="field-mapper-row">
              <div className="field-mapper-label">{field.label}</div>
              <div style={{ flex: 1 }}>
                <select
                  value={mapping[field.name] ?? ''}
                  onChange={(e) => onFieldMappingChange(field.name, e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">-- unmapped --</option>
                  {sheetHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {sampleRow && mapping[field.name] && (
                  <div className="field-mapper-sample">
                    {sampleRow[mapping[field.name]] || '(empty)'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Slots */}
      {template.imageSlots.length > 0 && (
        <div className="field-mapper-group">
          <div className="field-mapper-group-title">Image Slots</div>
          {template.imageSlots.map((slot) => (
            <div key={slot.name} className="field-mapper-row">
              <div className="field-mapper-label image">{slot.label}</div>
              <div style={{ flex: 1, display: 'flex', gap: 'var(--sp-2)' }}>
                <select
                  value={mapping[slot.name] ?? ''}
                  onChange={(e) => onFieldMappingChange(slot.name, e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">-- unmapped --</option>
                  {sheetHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {onBrowseImage && (
                  <button
                    className="secondary sm"
                    onClick={() => onBrowseImage(slot.name)}
                  >
                    Browse
                  </button>
                )}
              </div>
              {sampleRow && mapping[slot.name] && (
                <div className="field-mapper-sample" style={{ width: '100%', paddingLeft: 152 }}>
                  {sampleRow[mapping[slot.name]] || '(empty)'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
