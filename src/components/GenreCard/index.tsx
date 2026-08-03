import CachedImage from '@app/components/Common/CachedImage';
import { withProperties } from '@app/utils/typeHelpers';
import { PencilIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import { useState } from 'react';

interface GenreCardProps {
  name: string;
  image?: string;
  url: string;
  canExpand?: boolean;
  onEdit?: () => void;
  editLabel?: string;
  overlayColor?: string;
}

const GenreCard = ({
  image,
  url,
  name,
  canExpand = false,
  onEdit,
  editLabel,
  overlayColor,
}: GenreCardProps) => {
  const [isHovered, setHovered] = useState(false);

  return (
    <div className="relative">
      <Link
        href={url}
        className={`relative flex h-32 items-center justify-center sm:h-36 ${
          canExpand ? 'w-full' : 'w-56 sm:w-72'
        } transform-gpu cursor-pointer p-8 shadow ring-1 transition duration-300 ease-in-out ${
          isHovered
            ? 'scale-105 bg-gray-700/100 ring-gray-500'
            : 'scale-100 bg-gray-800/80 ring-gray-700'
        } overflow-hidden rounded-xl bg-cover bg-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400`}
        onMouseEnter={() => {
          setHovered(true);
        }}
        onMouseLeave={() => setHovered(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setHovered(true);
          }
        }}
      >
        {image && (
          <CachedImage
            type="tmdb"
            src={image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
          />
        )}
        <div
          className={`absolute inset-0 z-10 h-full w-full transition duration-300 ${
            overlayColor
              ? isHovered
                ? 'opacity-25'
                : 'opacity-55'
              : isHovered
                ? 'bg-gray-800/10'
                : 'bg-gray-800/30'
          }`}
          style={overlayColor ? { backgroundColor: overlayColor } : undefined}
        />
        <div className="relative z-20 w-full truncate whitespace-normal text-center text-2xl font-bold text-white sm:text-3xl">
          {name}
        </div>
      </Link>
      {onEdit && (
        <button
          type="button"
          aria-label={editLabel}
          title={editLabel}
          className="absolute right-2 top-2 z-30 rounded-full bg-gray-900/80 p-2 text-gray-200 shadow transition hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEdit();
          }}
        >
          <PencilIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

const GenreCardPlaceholder = () => {
  return (
    <div
      className={`relative h-32 w-56 animate-pulse rounded-xl bg-gray-700 sm:h-40 sm:w-72`}
    />
  );
};

export default withProperties(GenreCard, { Placeholder: GenreCardPlaceholder });
