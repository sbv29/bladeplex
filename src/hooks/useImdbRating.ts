import type { IMDBRating } from '@server/api/rating/imdbRadarrProxy';
import type { ImdbRatingBatchResponse } from '@server/api/ratings';
import { MediaType } from '@server/constants/media';
import axios from 'axios';
import { useEffect, useState } from 'react';

const MAX_BATCH_SIZE = 40;
const BATCH_DELAY_MS = 40;
type RatingMediaType = MediaType.MOVIE | MediaType.TV;
const cacheKey = (tmdbId: number, mediaType: RatingMediaType) =>
  `${mediaType}:${tmdbId}`;
const ratingCache = new Map<string, IMDBRating | null>();
const pendingListeners = new Map<
  string,
  {
    tmdbId: number;
    mediaType: RatingMediaType;
    listeners: Set<(rating: IMDBRating | null) => void>;
  }
>();
let batchTimer: ReturnType<typeof setTimeout> | undefined;

const flushRatings = async (): Promise<void> => {
  batchTimer = undefined;
  const pending = [...pendingListeners.values()];

  for (const mediaType of [MediaType.MOVIE, MediaType.TV] as const) {
    const entries = pending.filter((entry) => entry.mediaType === mediaType);
    for (let index = 0; index < entries.length; index += MAX_BATCH_SIZE) {
      const batch = entries.slice(index, index + MAX_BATCH_SIZE);
      const tmdbIds = batch.map((entry) => entry.tmdbId);

      try {
        const response = await axios.post<ImdbRatingBatchResponse>(
          '/api/v1/ratings/imdb/batch',
          { tmdbIds, mediaType }
        );

        batch.forEach((entry) => {
          const key = cacheKey(entry.tmdbId, mediaType);
          const rating = response.data.ratings[String(entry.tmdbId)] ?? null;
          ratingCache.set(key, rating);
          entry.listeners.forEach((listener) => listener(rating));
          pendingListeners.delete(key);
        });
      } catch {
        batch.forEach((entry) => {
          entry.listeners.forEach((listener) => listener(null));
          pendingListeners.delete(cacheKey(entry.tmdbId, mediaType));
        });
      }
    }
  }
};

const subscribe = (
  tmdbId: number,
  mediaType: RatingMediaType,
  listener: (rating: IMDBRating | null) => void
): (() => void) => {
  const key = cacheKey(tmdbId, mediaType);
  const listeners = pendingListeners.get(key)?.listeners ?? new Set();
  listeners.add(listener);
  pendingListeners.set(key, { tmdbId, mediaType, listeners });

  if (!batchTimer) {
    batchTimer = setTimeout(flushRatings, BATCH_DELAY_MS);
  }

  return () => {
    const currentListeners = pendingListeners.get(key)?.listeners;
    currentListeners?.delete(listener);
    if (currentListeners?.size === 0) {
      pendingListeners.delete(key);
    }
  };
};

const useImdbRating = (
  tmdbId: number,
  mediaType: RatingMediaType,
  enabled: boolean
): IMDBRating | null | undefined => {
  const key = cacheKey(tmdbId, mediaType);
  const [rating, setRating] = useState<IMDBRating | null | undefined>(() =>
    ratingCache.get(key)
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (ratingCache.has(key)) {
      setRating(ratingCache.get(key));
      return;
    }

    setRating(undefined);
    return subscribe(tmdbId, mediaType, setRating);
  }, [enabled, key, mediaType, tmdbId]);

  return rating;
};

export default useImdbRating;
