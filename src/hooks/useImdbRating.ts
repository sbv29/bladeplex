import type { IMDBRating } from '@server/api/rating/imdbRadarrProxy';
import type { ImdbRatingBatchResponse } from '@server/api/ratings';
import axios from 'axios';
import { useEffect, useState } from 'react';

const MAX_BATCH_SIZE = 40;
const BATCH_DELAY_MS = 40;
const ratingCache = new Map<number, IMDBRating | null>();
const pendingListeners = new Map<
  number,
  Set<(rating: IMDBRating | null) => void>
>();
let batchTimer: ReturnType<typeof setTimeout> | undefined;

const flushRatings = async (): Promise<void> => {
  batchTimer = undefined;
  const tmdbIds = [...pendingListeners.keys()];

  for (let index = 0; index < tmdbIds.length; index += MAX_BATCH_SIZE) {
    const batch = tmdbIds.slice(index, index + MAX_BATCH_SIZE);

    try {
      const response = await axios.post<ImdbRatingBatchResponse>(
        '/api/v1/ratings/imdb/batch',
        { tmdbIds: batch }
      );

      batch.forEach((tmdbId) => {
        const rating = response.data.ratings[String(tmdbId)] ?? null;
        ratingCache.set(tmdbId, rating);
        pendingListeners.get(tmdbId)?.forEach((listener) => listener(rating));
        pendingListeners.delete(tmdbId);
      });
    } catch {
      batch.forEach((tmdbId) => {
        pendingListeners.get(tmdbId)?.forEach((listener) => listener(null));
        pendingListeners.delete(tmdbId);
      });
    }
  }
};

const subscribe = (
  tmdbId: number,
  listener: (rating: IMDBRating | null) => void
): (() => void) => {
  const listeners = pendingListeners.get(tmdbId) ?? new Set();
  listeners.add(listener);
  pendingListeners.set(tmdbId, listeners);

  if (!batchTimer) {
    batchTimer = setTimeout(flushRatings, BATCH_DELAY_MS);
  }

  return () => {
    const currentListeners = pendingListeners.get(tmdbId);
    currentListeners?.delete(listener);
    if (currentListeners?.size === 0) {
      pendingListeners.delete(tmdbId);
    }
  };
};

const useImdbRating = (
  tmdbId: number,
  enabled: boolean
): IMDBRating | null | undefined => {
  const [rating, setRating] = useState<IMDBRating | null | undefined>(() =>
    ratingCache.get(tmdbId)
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (ratingCache.has(tmdbId)) {
      setRating(ratingCache.get(tmdbId));
      return;
    }

    setRating(undefined);
    return subscribe(tmdbId, setRating);
  }, [enabled, tmdbId]);

  return rating;
};

export default useImdbRating;
