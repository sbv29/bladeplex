import type { ImdbRatingBatchResponse } from '@server/api/ratings';
import imdbRatingCache from '@server/lib/imdbRatingCache';
import { Router } from 'express';

const ratingsRoutes = Router();
const MAX_BATCH_SIZE = 40;

ratingsRoutes.post<unknown, ImdbRatingBatchResponse, { tmdbIds?: number[] }>(
  '/imdb/batch',
  async (req, res) => {
    const tmdbIds = [
      ...new Set(
        (req.body.tmdbIds ?? []).filter(
          (id): id is number => Number.isInteger(id) && id > 0
        )
      ),
    ].slice(0, MAX_BATCH_SIZE);

    if (tmdbIds.length === 0) {
      return res.status(200).json({ ratings: {} });
    }

    const ratings = await imdbRatingCache.getRatings(tmdbIds);

    return res.status(200).json({ ratings });
  }
);

export default ratingsRoutes;
