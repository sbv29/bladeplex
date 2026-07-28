import IMDBRadarrProxy, {
  type IMDBRating,
} from '@server/api/rating/imdbRadarrProxy';
import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { ImdbRatingCache } from '@server/entity/ImdbRatingCache';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import { In } from 'typeorm';

const REQUEST_CONCURRENCY = 5;

export interface ImdbRatingCacheStatus {
  running: boolean;
  progress: number;
  total: number;
}

class ImdbRatingCacheService {
  private running = false;
  private cancelled = false;
  private progress = 0;
  private total = 0;

  public status(): ImdbRatingCacheStatus {
    return {
      running: this.running,
      progress: this.progress,
      total: this.total,
    };
  }

  public cancel(): void {
    this.cancelled = true;
  }

  public async count(): Promise<number> {
    return await getRepository(ImdbRatingCache).count();
  }

  public async clear(): Promise<void> {
    await getRepository(ImdbRatingCache).clear();
  }

  public async getRatings(
    tmdbIds: number[],
    knownImdbIds: Map<number, string> = new Map()
  ): Promise<Record<string, IMDBRating | null>> {
    const repository = getRepository(ImdbRatingCache);
    const cached = await repository.findBy({ tmdbId: In(tmdbIds) });
    const cachedByTmdbId = new Map(cached.map((item) => [item.tmdbId, item]));
    const ratings: Record<string, IMDBRating | null> = {};

    for (const item of cached) {
      ratings[String(item.tmdbId)] = this.toRating(item);
    }

    const uncachedIds = tmdbIds.filter((id) => !cachedByTmdbId.has(id));
    const localMedia = uncachedIds.length
      ? await getRepository(Media).findBy({
          tmdbId: In(uncachedIds),
          mediaType: MediaType.MOVIE,
        })
      : [];
    const imdbIds = new Map([
      ...localMedia
        .filter((item) => item.imdbId)
        .map((item): [number, string] => [item.tmdbId, item.imdbId as string]),
      ...knownImdbIds,
    ]);

    await this.processWithConcurrency(
      uncachedIds,
      REQUEST_CONCURRENCY,
      async (tmdbId) => {
        try {
          const item = await this.refreshTmdbId(
            tmdbId,
            false,
            undefined,
            imdbIds.get(tmdbId)
          );
          ratings[String(tmdbId)] = this.toRating(item);
        } catch (e) {
          ratings[String(tmdbId)] = null;
          logger.debug('Unable to retrieve IMDb card rating', {
            label: 'API',
            errorMessage: e.message,
            tmdbId,
          });
        }
      }
    );

    return ratings;
  }

  public async refreshAll(): Promise<void> {
    if (this.running) {
      return;
    }

    const repository = getRepository(ImdbRatingCache);
    this.running = true;
    this.cancelled = false;
    this.progress = 0;

    try {
      const records = await repository.find({ order: { updatedAt: 'ASC' } });
      this.total = records.length;

      logger.info(`Refreshing ${records.length} cached IMDb ratings`, {
        label: 'IMDb Ratings Cache',
      });

      await this.processWithConcurrency(records, 3, async (record) => {
        if (this.cancelled) {
          return;
        }

        try {
          await this.refreshTmdbId(record.tmdbId, true, record);
        } catch (e) {
          logger.warn('Failed to refresh cached IMDb rating', {
            label: 'IMDb Ratings Cache',
            errorMessage: e.message,
            tmdbId: record.tmdbId,
            imdbId: record.imdbId,
          });
        } finally {
          this.progress += 1;
        }
      });
    } finally {
      logger.info(
        this.cancelled
          ? 'IMDb ratings cache refresh canceled'
          : 'IMDb ratings cache refresh complete',
        {
          label: 'IMDb Ratings Cache',
          processed: this.progress,
          total: this.total,
        }
      );
      this.running = false;
    }
  }

  private async refreshTmdbId(
    tmdbId: number,
    forceRefresh: boolean,
    existing?: ImdbRatingCache,
    knownImdbId?: string
  ): Promise<ImdbRatingCache> {
    const repository = getRepository(ImdbRatingCache);
    const record =
      existing ??
      (await repository.findOneBy({ tmdbId })) ??
      repository.create({ tmdbId, missing: false, failureCount: 0 });
    record.lastAttemptAt = new Date();

    try {
      if (!record.imdbId) {
        record.imdbId = knownImdbId;

        if (!record.imdbId) {
          const externalIds = await new TheMovieDb().getMovieExternalIds(
            tmdbId
          );
          record.imdbId = externalIds.imdb_id;
        }
      }

      if (!record.imdbId) {
        record.missing = true;
        record.failureCount = 0;
        return await repository.save(record);
      }

      const rating = await new IMDBRadarrProxy().getMovieRatings(
        record.imdbId,
        forceRefresh
      );

      if (!rating) {
        record.missing = record.ratingTenths == null;
        record.failureCount = 0;
        return await repository.save(record);
      }

      record.title = rating.title;
      record.ratingTenths = Math.round(rating.criticsScore * 10);
      record.voteCount = rating.criticsScoreCount;
      record.url = rating.url;
      record.missing = false;
      record.failureCount = 0;
      record.lastSuccessAt = new Date();
      return await repository.save(record);
    } catch (e) {
      record.failureCount += 1;
      await repository.save(record);
      throw e;
    }
  }

  private toRating(item: ImdbRatingCache): IMDBRating | null {
    if (item.ratingTenths == null || item.voteCount == null || !item.imdbId) {
      return null;
    }

    return {
      title: item.title ?? '',
      url: item.url ?? `https://www.imdb.com/title/${item.imdbId}`,
      criticsScore: item.ratingTenths / 10,
      criticsScoreCount: item.voteCount,
    };
  }

  private async processWithConcurrency<T>(
    items: T[],
    concurrency: number,
    process: (item: T) => Promise<void>
  ): Promise<void> {
    for (let index = 0; index < items.length; index += concurrency) {
      if (this.cancelled && this.running) {
        break;
      }
      await Promise.all(items.slice(index, index + concurrency).map(process));
    }
  }
}

const imdbRatingCache = new ImdbRatingCacheService();

export default imdbRatingCache;
