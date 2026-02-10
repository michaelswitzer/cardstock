interface CardGridProps {
  cardImages: string[];
  cardLabels?: string[];
}

export default function CardGrid({ cardImages, cardLabels }: CardGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}
    >
      {cardImages.map((src, i) => (
        <div
          key={i}
          style={{
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: 'var(--surface)',
          }}
        >
          <img
            src={src}
            alt={`Card ${i + 1}`}
            style={{ width: '100%', display: 'block' }}
          />
          <div
            style={{
              padding: '4px 8px',
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            {cardLabels?.[i] ? `Card ${i + 1}: ${cardLabels[i]}` : `Card ${i + 1}`}
          </div>
        </div>
      ))}
    </div>
  );
}
