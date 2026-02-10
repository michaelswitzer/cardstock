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
        gap: 'var(--sp-3)',
      }}
    >
      {cardImages.map((src, i) => (
        <div key={i} className="card-item">
          <img
            src={src}
            alt={`Card ${i + 1}`}
            style={{ width: '100%', display: 'block' }}
          />
          <div
            style={{
              padding: 'var(--sp-1) var(--sp-2)',
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
