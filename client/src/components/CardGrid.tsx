import { useState, useEffect, useCallback } from 'react';

type CardStatus = 'green' | 'yellow' | 'red';

interface CardGridProps {
  cardImages: string[];
  cardLabels?: string[];
  cardIds?: string[];
  rawLabelCount?: number;
  cardZoom?: number;
  cardStatus?: CardStatus[];
}

export default function CardGrid({
  cardImages,
  cardLabels,
  cardIds,
  rawLabelCount = 0,
  cardZoom = 240,
  cardStatus,
}: CardGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const getLabel = (i: number) => {
    if (i < rawLabelCount) {
      return cardLabels?.[i] || `Card ${i + 1}`;
    }
    const idx = i - rawLabelCount;
    const id = cardIds?.[idx] || `Card ${idx + 1}`;
    const label = cardLabels?.[i];
    return label ? `${id}: ${label}` : id;
  };

  const handleCardClick = (i: number) => {
    setLightboxIndex(i);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (lightboxIndex === null) return;
    if (e.key === 'Escape') {
      setLightboxIndex(null);
    } else if (e.key === 'ArrowLeft') {
      setLightboxIndex((i) => i !== null && i > 0 ? i - 1 : i);
    } else if (e.key === 'ArrowRight') {
      setLightboxIndex((i) => i !== null && i < cardImages.length - 1 ? i + 1 : i);
    }
  }, [lightboxIndex, cardImages.length]);

  useEffect(() => {
    if (lightboxIndex !== null) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [lightboxIndex, handleKeyDown]);

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${cardZoom}px, 1fr))`,
          gap: 'var(--sp-3)',
        }}
      >
        {cardImages.map((src, i) => (
          <div
            key={i}
            className="card-item"
            style={{ cursor: 'pointer' }}
            onClick={() => handleCardClick(i)}
          >
            {cardStatus && cardStatus[i] && (
              <div className={`card-status-dot ${cardStatus[i]}`} style={{ position: 'absolute' }} />
            )}
            <img
              src={src}
              alt={getLabel(i)}
              style={{ width: '100%', display: 'block' }}
            />
            <div
              style={{
                padding: 'var(--sp-1) var(--sp-2)',
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {getLabel(i)}
            </div>
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div
          className="lightbox-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxIndex(null);
          }}
        >
          <button
            className="lightbox-close"
            onClick={() => setLightboxIndex(null)}
          >
            {'\u2715'}
          </button>

          {lightboxIndex > 0 && (
            <button
              className="lightbox-nav prev"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
            >
              {'\u2190'}
            </button>
          )}

          {lightboxIndex < cardImages.length - 1 && (
            <button
              className="lightbox-nav next"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
            >
              {'\u2192'}
            </button>
          )}

          <div className="lightbox-content">
            <img
              src={cardImages[lightboxIndex]}
              alt={getLabel(lightboxIndex)}
            />
            <div className="lightbox-label">
              {getLabel(lightboxIndex)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
