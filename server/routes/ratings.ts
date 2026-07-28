import type {
  ImdbRatingBatchRequest,
  ImdbRatingBatchResponse,
} from '@server/api/ratings';
import { MediaType } from '@server/constants/media';
import imdbRatingCache from '@server/lib/imdbRatingCache';
import { Router } from 'express';

const ratingsRoutes = Router();
const MAX_BATCH_SIZE = 40;

ratingsRoutes.post<unknown, ImdbRatingBatchResponse, ImdbRatingBatchRequest>(
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

    const mediaType =
      req.body.mediaType === MediaType.TV ? MediaType.TV : MediaType.MOVIE;
    const ratings = await imdbRatingCache.getRatings(
      tmdbIds,
      new Map(),
      mediaType
    );

    return res.status(200).json({ ratings });
  }
);

export default ratingsRoutes;
