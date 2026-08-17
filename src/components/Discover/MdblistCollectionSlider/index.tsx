import GenreCard from '@app/components/GenreCard';
import Slider from '@app/components/Slider';
import useToasts from '@app/hooks/useToasts';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowUturnLeftIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { useRouter } from 'next/router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.MdblistCollectionSlider', {
  moviesTitle: 'Movie Collections',
  tvTitle: 'TV Collections',
  edit: 'Edit {title}',
  shuffle: 'Shuffle movie collections',
  reset: 'Reset movie collections to alphabetical order',
  reorderFailed: 'Unable to save the movie collection order.',
});

export interface MdblistCollectionTile {
  id: number;
  title: string;
  itemCount: number;
  mediaType: 'movie' | 'tv';
  selectedArtworkPosterPath?: string | null;
  artworkOverlayColor?: string | null;
}

const MdblistCollectionSlider = ({
  mediaType,
}: {
  mediaType: 'movie' | 'tv';
}) => {
  const intl = useIntl();
  const router = useRouter();
  const { user } = useUser();
  const { addToast } = useToasts();
  const { data, error, mutate } = useSWR<MdblistCollectionTile[]>(
    '/api/v1/discover/mdblist/collections',
    { revalidateOnFocus: false }
  );
  const [orderedCollections, setOrderedCollections] = useState<
    MdblistCollectionTile[]
  >([]);
  const orderedCollectionsRef = useRef<MdblistCollectionTile[]>([]);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchDraggingRef = useRef(false);
  const suppressClickRef = useRef(false);

  const collections = useMemo(
    () => data?.filter((item) => item.mediaType === mediaType),
    [data, mediaType]
  );

  useEffect(() => {
    if (!collections || draggedId !== null) return;
    setOrderedCollections(collections);
    orderedCollectionsRef.current = collections;
  }, [collections, draggedId]);

  const updateOrder = useCallback((dragged: number, target: number) => {
    setOrderedCollections((current) => {
      const from = current.findIndex((item) => item.id === dragged);
      const to = current.findIndex((item) => item.id === target);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      orderedCollectionsRef.current = next;
      return next;
    });
  }, []);

  const persistOrder = useCallback(
    async (next: MdblistCollectionTile[]) => {
      const previous = data;
      if (!previous) return;

      const ids = next.map((item) => item.id);
      const nextIds = new Set(ids);
      let nextIndex = 0;
      const optimistic = previous.map((item) =>
        nextIds.has(item.id) ? next[nextIndex++] : item
      );

      await mutate(optimistic, { revalidate: false });
      try {
        await axios.put('/api/v1/settings/mdblist-collections/reorder', {
          ids,
          mediaType,
        });
        await mutate();
      } catch {
        orderedCollectionsRef.current = previous.filter(
          (item) => item.mediaType === mediaType
        );
        setOrderedCollections(orderedCollectionsRef.current);
        await mutate(previous, { revalidate: false });
        addToast(intl.formatMessage(messages.reorderFailed), {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    },
    [addToast, data, intl, mediaType, mutate]
  );

  const applyOrder = (next: MdblistCollectionTile[]) => {
    orderedCollectionsRef.current = next;
    setOrderedCollections(next);
    void persistOrder([...next]);
  };

  const shuffle = () => {
    const next = [...orderedCollectionsRef.current];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    if (
      next.length > 1 &&
      next.every(
        (item, index) => item.id === orderedCollectionsRef.current[index].id
      )
    ) {
      next.push(next.shift() as MdblistCollectionTile);
    }
    applyOrder(next);
  };

  const resetAlphabetically = () => {
    applyOrder(
      [...orderedCollectionsRef.current].sort((left, right) =>
        left.title.localeCompare(right.title, undefined, {
          sensitivity: 'base',
          numeric: true,
        })
      )
    );
  };

  const finishDrag = () => {
    if (draggedId !== null || touchDraggingRef.current) {
      void persistOrder([...orderedCollectionsRef.current]);
    }
    setDraggedId(null);
    touchDraggingRef.current = false;
  };

  const clearTouchTimer = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = null;
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    id: number
  ) => {
    if (event.pointerType === 'mouse') return;
    clearTouchTimer();
    touchStartRef.current = { x: event.clientX, y: event.clientY };
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    touchTimerRef.current = setTimeout(() => {
      target.setPointerCapture(pointerId);
      touchDraggingRef.current = true;
      suppressClickRef.current = true;
      setDraggedId(id);
    }, 400);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const deltaX = event.clientX - touchStartRef.current.x;
    const deltaY = event.clientY - touchStartRef.current.y;
    if (!touchDraggingRef.current) {
      if (Math.hypot(deltaX, deltaY) > 8) {
        clearTouchTimer();
      }
      return;
    }

    event.preventDefault();
    const target = document
      .elementsFromPoint(event.clientX, event.clientY)
      .map((element) => element.closest<HTMLElement>('[data-collection-id]'))
      .find(Boolean);
    const targetId = Number(target?.dataset.collectionId);
    if (draggedId !== null && Number.isFinite(targetId)) {
      updateOrder(draggedId, targetId);
    }
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, id: number) => {
    setDraggedId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(id));
  };

  if ((collections && collections.length === 0) || error) return null;

  const canReorder = mediaType === 'movie' && user?.id === 1;

  return (
    <>
      <div className="slider-header">
        <div className="slider-title gap-1">
          <span>
            {intl.formatMessage(
              mediaType === 'movie' ? messages.moviesTitle : messages.tvTitle
            )}
          </span>
          {canReorder && (
            <div className="ml-1 inline-flex items-center gap-0.5 text-gray-300">
              <button
                type="button"
                aria-label={intl.formatMessage(messages.shuffle)}
                title={intl.formatMessage(messages.shuffle)}
                onClick={shuffle}
                disabled={orderedCollections.length < 2}
                className="rounded bg-transparent p-1 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-40"
              >
                <ArrowsRightLeftIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={intl.formatMessage(messages.reset)}
                title={intl.formatMessage(messages.reset)}
                onClick={resetAlphabetically}
                disabled={orderedCollections.length < 2}
                className="rounded bg-transparent p-1 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-40"
              >
                <ArrowUturnLeftIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      <Slider
        sliderKey="mdblist-collections"
        isLoading={!data}
        isEmpty={false}
        items={(data ? orderedCollections : []).map((collection) => (
          <div
            key={collection.id}
            data-collection-id={collection.id}
            draggable={canReorder}
            onDragStart={(event) => handleDragStart(event, collection.id)}
            onDragEnter={() => {
              if (draggedId !== null) updateOrder(draggedId, collection.id);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragEnd={finishDrag}
            onPointerDown={(event) =>
              canReorder && handlePointerDown(event, collection.id)
            }
            onPointerMove={(event) => canReorder && handlePointerMove(event)}
            onPointerUp={() => {
              clearTouchTimer();
              finishDrag();
            }}
            onPointerCancel={() => {
              clearTouchTimer();
              finishDrag();
            }}
            onClickCapture={(event) => {
              if (suppressClickRef.current) {
                event.preventDefault();
                event.stopPropagation();
                suppressClickRef.current = false;
              }
            }}
            className={`${
              canReorder ? 'cursor-grab touch-auto active:cursor-grabbing' : ''
            } ${draggedId === collection.id ? 'opacity-60' : ''}`}
          >
            <GenreCard
              name={collection.title}
              image={
                collection.selectedArtworkPosterPath
                  ? `https://image.tmdb.org/t/p/w1280${collection.selectedArtworkPosterPath}`
                  : undefined
              }
              url={
                mediaType === 'movie'
                  ? `/discover/movies/mdblist/${collection.id}`
                  : `/discover/tv/mdblist-collection/${collection.id}`
              }
              overlayColor={collection.artworkOverlayColor ?? '#4f46e5'}
              onEdit={
                user?.id === 1
                  ? () =>
                      router.push(
                        `/settings/mdblist-collections?edit=${collection.id}`
                      )
                  : undefined
              }
              editLabel={intl.formatMessage(messages.edit, {
                title: collection.title,
              })}
            />
          </div>
        ))}
        placeholder={<GenreCard.Placeholder />}
        emptyMessage=""
      />
    </>
  );
};

export default MdblistCollectionSlider;
