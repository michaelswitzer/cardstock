interface CardGridProps {
  cardImages: string[];
  selectedCards: number[];
  onToggle: (index: number) => void;
}

export default function CardGrid({ cardImages, selectedCards, onToggle }: CardGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      {cardImages.map((src, i) => (
        <div
          key={i}
          onClick={() => onToggle(i)}
          style={{
            cursor: 'pointer',
            border: selectedCards.includes(i)
              ? '3px solid var(--primary)'
              : '3px solid transparent',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: 'var(--surface)',
            transition: 'border-color 0.2s',
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
            Card {i + 1}
          </div>
        </div>
      ))}
    </div>
  );
}
