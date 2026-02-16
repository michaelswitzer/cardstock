import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchImages, fetchCovers, fetchCardbacks } from '../api/client';

type AssetCategory = 'cardart' | 'cardback' | 'icons' | 'covers';

interface AssetBrowserProps {
  gameId: string;
  category: AssetCategory;
  onCategoryChange: (category: AssetCategory) => void;
  onSelect: (filename: string) => void;
  onClose: () => void;
  selectedValue?: string;
}

export default function AssetBrowser({
  gameId,
  category,
  onCategoryChange,
  onSelect,
  onClose,
  selectedValue,
}: AssetBrowserProps) {
  const [search, setSearch] = useState('');

  const { data: allImages } = useQuery({
    queryKey: ['images', gameId],
    queryFn: () => fetchImages(gameId),
    enabled: category === 'cardart' || category === 'icons',
  });

  const { data: coverImages } = useQuery({
    queryKey: ['covers', gameId],
    queryFn: () => fetchCovers(gameId),
    enabled: category === 'covers',
  });

  const { data: cardbackImages } = useQuery({
    queryKey: ['cardbacks', gameId],
    queryFn: () => fetchCardbacks(gameId),
    enabled: category === 'cardback',
  });

  const getImages = (): string[] => {
    switch (category) {
      case 'cardart':
        return (allImages?.images ?? []).filter((img) => img.startsWith('cardart/'));
      case 'cardback':
        return cardbackImages?.images ?? [];
      case 'icons':
        return (allImages?.images ?? []).filter((img) => img.startsWith('icons/'));
      case 'covers':
        return coverImages?.images ?? [];
      default:
        return [];
    }
  };

  const images = getImages();
  const filteredImages = search
    ? images.filter((img) => img.toLowerCase().includes(search.toLowerCase()))
    : images;

  const getThumbUrl = (img: string): string => {
    switch (category) {
      case 'cardart':
      case 'icons':
        return `/api/games/${gameId}/images/thumb/artwork/${img}?w=200&h=200`;
      case 'cardback':
        return `/api/games/${gameId}/images/thumb/artwork/cardback/${img}?w=200&h=280`;
      case 'covers':
        return `/api/games/${gameId}/images/thumb/${img}?w=200&h=200`;
      default:
        return '';
    }
  };

  const getDisplayName = (img: string): string => {
    return img.split('/').pop() ?? img;
  };

  const categories: { key: AssetCategory; label: string }[] = [
    { key: 'cardart', label: 'Card Art' },
    { key: 'cardback', label: 'Card Backs' },
    { key: 'icons', label: 'Icons' },
    { key: 'covers', label: 'Covers' },
  ];

  return (
    <>
      <div className="asset-browser-overlay" onClick={onClose} />
      <div className="asset-browser">
        <div className="asset-browser-header">
          <h2>Assets</h2>
          <button className="secondary sm" onClick={onClose}>{'\u2715'}</button>
        </div>

        {/* Category tabs */}
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {categories.map((cat) => (
            <button
              key={cat.key}
              className={category === cat.key ? 'active' : ''}
              onClick={() => { onCategoryChange(cat.key); setSearch(''); }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="asset-browser-search">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by filename..."
          />
        </div>

        {/* Image grid */}
        <div className="asset-browser-grid">
          {filteredImages.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--sp-5)', color: 'var(--text-muted)' }}>
              {search ? 'No matching images' : 'No images in this category'}
            </div>
          )}
          {filteredImages.map((img) => {
            const displayName = getDisplayName(img);
            const isSelected = selectedValue === displayName || selectedValue === img;
            return (
              <div
                key={img}
                className={`asset-browser-item${isSelected ? ' selected' : ''}`}
                onClick={() => onSelect(displayName)}
              >
                <img src={getThumbUrl(img)} alt={displayName} />
                <div className="asset-browser-item-name">{displayName}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
