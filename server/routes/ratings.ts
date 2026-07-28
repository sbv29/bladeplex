import IMDBRadarrProxy, {
  type IMDBRating,
} from '@server/api/rating/imdbRadarrProxy';
import type { ImdbRatingBatchResponse } from '@server/api/ratings';
import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import Media from '@server/entity/Media';
import cacheManager from '@server/lib/cache';
import logger from '@server/logger';
import { Router } from 'express';

const ratingsRoutes = Router();
const MAX_BATCH_SIZE = 40;
const EXTERNAL_REQUEST_CONCURRENCY = 5;

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

    const tmdb = new TheMovieDb();
    const imdb = new IMDBRadarrProxy();
    const idCache = cacheManager.getCache('imdbid').data;
    const ratingCache = cacheManager.getCache('imdb').data;
    const media = await Media.getRelatedMedia(
      req.user,
      tmdbIds.map((tmdbId) => ({ tmdbId, mediaType: MediaType.MOVIE }))
    );
    const localImdbIds = new Map(
      media
        .filter((item) => item.imdbId)
        .map((item) => [item.tmdbId, item.imdbId as string])
    );
    const ratings: Record<string, IMDBRating | null> = {};

    const fetchRating = async (tmdbId: number): Promise<void> => {
      const cacheKey = `movie:${tmdbId}`;
      let imdbId = localImdbIds.get(tmdbId);

      try {
        if (!imdbId && idCache.has(cacheKey)) {
          imdbId = idCache.get<string | null>(cacheKey) ?? undefined;
        } else if (!imdbId) {
          const externalIds = await tmdb.getMovieExternalIds(tmdbId);
          imdbId = externalIds.imdb_id;
          idCache.set(cacheKey, imdbId ?? null);
        }

        if (!imdbId) {
          ratings[String(tmdbId)] = null;
          return;
        }

        const ratingCacheKey = `card:${imdbId}`;
        if (ratingCache.has(ratingCacheKey)) {
          ratings[String(tmdbId)] =
            ratingCache.get<IMDBRating | null>(ratingCacheKey) ?? null;
          return;
        }

        const rating = await imdb.getMovieRatings(imdbId);
        ratingCache.set(ratingCacheKey, rating);
        ratings[String(tmdbId)] = rating;
      } catch (e) {
        ratings[String(tmdbId)] = null;
        logger.debug('Unable to retrieve IMDb card rating', {
          label: 'API',
          errorMessage: e.message,
          tmdbId,
        });
      }
    };

    for (
      let index = 0;
      index < tmdbIds.length;
      index += EXTERNAL_REQUEST_CONCURRENCY
    ) {
      await Promise.all(
        tmdbIds
          .slice(index, index + EXTERNAL_REQUEST_CONCURRENCY)
          .map(fetchRating)
      );
    }

    return res.status(200).json({ ratings });
  }
);

export default ratingsRoutes;
