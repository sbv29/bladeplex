import MdblistRatingsAPI, {
  type MdblistImdbRating,
  type MdblistQuotaSnapshot,
} from '@server/api/mdblist/ratings';
import type { IMDBRating } from '@server/api/rating/imdbRadarrProxy';
import { MediaType } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import { ImdbRatingCache } from '@server/entity/ImdbRatingCache';
import Media from '@server/entity/Media';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios from 'axios';
import { In, IsNull, LessThanOrEqual } from 'typeorm';

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 100;
const QUEUE_DELAY_MS = 250;
const QUEUE_LIMIT = 2_000;
const SUCCESS_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const MISSING_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const PROVIDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const PROVIDER_FAILURE_THRESHOLD = 3;
const RATINGS_QUOTA_RESERVE = 300;
const RATING_SOURCE = 'mdblist-imdb';

const getBatchSize = (): number => {
  const configured = Number(process.env.MDBLIST_RATINGS_BATCH_SIZE);
  return Number.isSafeInteger(configured)
    ? Math.min(MAX_BATCH_SIZE, Math.max(1, configured))
    : DEFAULT_BATCH_SIZE;
};

const retryDelayMs = (failureCount: number): number => {
  const days = [1, 3, 7, 30][Math.min(3, Math.max(0, failureCount - 1))];
  return days * 24 * 60 * 60 * 1000;
};

export interface ImdbRatingCacheStatus {
  running: boolean;
  progress: number;
  total: number;
  batches: number;
  requests: number;
  successes: number;
  missing: number;
  failures: number;
  queued: number;
  quota: MdblistQuotaSnapshot;
  cooldownUntil?: Date;
}

type RatingMediaType = MediaType.MOVIE | MediaType.TV;

class ImdbRatingCacheService {
  private running = false;
  private cancelled = false;
  private progress = 0;
  private total = 0;
  private batches = 0;
  private requests = 0;
  private successes = 0;
  private missingCount = 0;
  private failures = 0;
  private readonly queued = new Map<string, ImdbRatingCache>();
  private queueTimer?: NodeJS.Timeout;
  private queueRunning = false;
  private consecutiveProviderFailures = 0;
  private cooldownUntil?: Date;
  private quota: MdblistQuotaSnapshot = {};
  private libraryWarmPromise?: Promise<void>;

  public status(): ImdbRatingCacheStatus {
    return {
      running: this.running,
      progress: this.progress,
      total: this.total,
      batches: this.batches,
      requests: this.requests,
      successes: this.successes,
      missing: this.missingCount,
      failures: this.failures,
      queued: this.queued.size,
      quota: this.quota,
      cooldownUntil: this.cooldownUntil,
    };
  }

  public cancel(): void {
    this.cancelled = true;
  }

  public async count(): Promise<number> {
    return await getRepository(ImdbRatingCache).count();
  }

  public warmLibrary(mediaServerType: MediaServerType): Promise<void> {
    if (!this.libraryWarmPromise) {
      this.libraryWarmPromise = this.seedLibraryRatings(
        mediaServerType
      ).finally(() => {
        this.libraryWarmPromise = undefined;
      });
    }

    return this.libraryWarmPromise;
  }

  public async clear(): Promise<void> {
    this.queued.clear();
    await getRepository(ImdbRatingCache).clear();
  }

  public async getRatings(
    tmdbIds: number[],
    knownImdbIds: Map<number, string> = new Map(),
    mediaType: RatingMediaType = MediaType.MOVIE
  ): Promise<Record<string, IMDBRating | null>> {
    const repository = getRepository(ImdbRatingCache);
    const uniqueIds = [...new Set(tmdbIds)];
    const cached = await repository.findBy({
      tmdbId: In(uniqueIds),
      mediaType,
    });
    const cachedById = new Map(cached.map((item) => [item.tmdbId, item]));
    const ratings: Record<string, IMDBRating | null> = {};

    for (const item of cached) {
      ratings[String(item.tmdbId)] = this.toRating(item);
    }

    const uncached = uniqueIds.filter((id) => !cachedById.has(id));
    if (uncached.length) {
      const records = await repository.save(
        uncached.map((tmdbId) =>
          repository.create({
            tmdbId,
            mediaType,
            imdbId: knownImdbIds.get(tmdbId),
            missing: false,
            failureCount: 0,
          })
        )
      );
      records.forEach((record) => {
        ratings[String(record.tmdbId)] = null;
        this.enqueue(record);
      });
    }

    return ratings;
  }

  private async seedLibraryRatings(
    mediaServerType: MediaServerType
  ): Promise<void> {
    const mediaRepository = getRepository(Media);
    const cacheRepository = getRepository(ImdbRatingCache);
    const mediaQuery = mediaRepository
      .createQueryBuilder('media')
      .select(['media.tmdbId', 'media.mediaType', 'media.imdbId'])
      .where('media.tmdbId > 0')
      .andWhere('media.mediaType IN (:...mediaTypes)', {
        mediaTypes: [MediaType.MOVIE, MediaType.TV],
      });

    if (mediaServerType === MediaServerType.JELLYFIN) {
      mediaQuery.andWhere(
        '(media.jellyfinMediaId IS NOT NULL OR media.jellyfinMediaId4k IS NOT NULL)'
      );
    } else {
      mediaQuery.andWhere(
        '(media.ratingKey IS NOT NULL OR media.ratingKey4k IS NOT NULL)'
      );
    }

    const libraryMedia = await mediaQuery.getMany();
    let seeded = 0;
    let queued = 0;
    const now = Date.now();

    for (const mediaType of [MediaType.MOVIE, MediaType.TV] as const) {
      const typedMedia = libraryMedia.filter(
        (media) => media.mediaType === mediaType
      );

      for (let index = 0; index < typedMedia.length; index += 500) {
        const batch = typedMedia.slice(index, index + 500);
        const uniqueMedia = [
          ...new Map(batch.map((media) => [media.tmdbId, media])).values(),
        ];
        const ids = uniqueMedia.map((media) => media.tmdbId);
        const cached = await cacheRepository.findBy({
          tmdbId: In(ids),
          mediaType,
        });
        const cachedById = new Map(
          cached.map((record) => [record.tmdbId, record])
        );
        const missing = uniqueMedia
          .filter((media) => !cachedById.has(media.tmdbId))
          .map((media) =>
            cacheRepository.create({
              tmdbId: media.tmdbId,
              mediaType,
              imdbId: media.imdbId,
              missing: false,
              failureCount: 0,
            })
          );
        const created = missing.length
          ? await cacheRepository.save(missing)
          : [];

        seeded += created.length;
        for (const record of [...cached, ...created]) {
          const unresolved =
            record.ratingTenths == null || record.voteCount == null;
          const retryDue =
            !record.nextRetryAt || record.nextRetryAt.getTime() <= now;
          if (unresolved && retryDue && this.queued.size < QUEUE_LIMIT) {
            const sizeBefore = this.queued.size;
            this.enqueue(record);
            if (this.queued.size > sizeBefore) queued += 1;
          }
        }
      }
    }

    logger.info('Seeded IMDb ratings cache from media library', {
      label: 'IMDb Ratings Cache',
      mediaServerType,
      libraryTitles: libraryMedia.length,
      seeded,
      queued,
    });
  }

  public async refreshAll(force = false): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const repository = getRepository(ImdbRatingCache);
      const now = new Date();
      const records = await repository.find({
        where: force
          ? undefined
          : [{ nextRetryAt: IsNull() }, { nextRetryAt: LessThanOrEqual(now) }],
        order: { nextRetryAt: 'ASC', updatedAt: 'ASC' },
      });

      this.resetRun(records.length);
      logger.info(
        `Refreshing ${records.length} ${
          force ? 'cached' : 'due cached'
        } IMDb ratings`,
        {
          label: 'IMDb Ratings Cache',
          provider: RATING_SOURCE,
        }
      );

      for (const mediaType of [MediaType.MOVIE, MediaType.TV] as const) {
        const typed = records.filter(
          (record) => record.mediaType === mediaType
        );
        for (let index = 0; index < typed.length; index += getBatchSize()) {
          if (this.cancelled || !this.canRequest()) break;
          await this.fetchBatch(typed.slice(index, index + getBatchSize()));
        }
      }
    } finally {
      this.running = false;
      logger.info(
        this.cancelled
          ? 'IMDb ratings cache refresh canceled'
          : 'IMDb ratings cache refresh complete',
        {
          label: 'IMDb Ratings Cache',
          processed: this.progress,
          total: this.total,
          requests: this.requests,
          successes: this.successes,
          missing: this.missingCount,
          failures: this.failures,
        }
      );
    }
  }

  public async processPending(): Promise<void> {
    if (this.queueRunning || this.running || !this.canRequest()) return;
    this.queueRunning = true;
    try {
      while (this.queued.size && this.canRequest()) {
        const first = this.queued.values().next().value as
          | ImdbRatingCache
          | undefined;
        if (!first) break;
        const batch = [...this.queued.values()]
          .filter((record) => record.mediaType === first.mediaType)
          .slice(0, getBatchSize());
        batch.forEach((record) => this.queued.delete(this.key(record)));
        await this.fetchBatch(batch);
      }
    } finally {
      this.queueRunning = false;
      if (this.queued.size && this.canRequest()) this.scheduleQueue();
    }
  }

  private enqueue(record: ImdbRatingCache): void {
    const key = this.key(record);
    if (!this.queued.has(key) && this.queued.size < QUEUE_LIMIT) {
      this.queued.set(key, record);
      this.scheduleQueue();
    }
  }

  private scheduleQueue(): void {
    if (this.queueTimer) return;
    this.queueTimer = setTimeout(() => {
      this.queueTimer = undefined;
      void this.processPending();
    }, QUEUE_DELAY_MS);
    this.queueTimer.unref();
  }

  private async fetchBatch(records: ImdbRatingCache[]): Promise<void> {
    if (!records.length) return;
    const apiKey = getSettings().main.mdblistApiKey;
    if (!apiKey) {
      await this.recordProviderFailure(records, new Error('API key missing'));
      return;
    }

    this.batches += 1;
    this.requests += 1;
    try {
      const result = await new MdblistRatingsAPI(apiKey).getImdbRatings(
        records[0].mediaType as RatingMediaType,
        records.map((record) => record.tmdbId)
      );
      this.quota = result.quota;
      this.consecutiveProviderFailures = 0;
      this.cooldownUntil = undefined;
      const ratings = new Map(
        result.ratings.map((rating) => [rating.tmdbId, rating])
      );

      for (const record of records) {
        const rating = ratings.get(record.tmdbId);
        if (rating) {
          await this.recordSuccess(record, rating);
        } else {
          await this.recordMissing(record);
        }
        this.progress += 1;
      }
    } catch (error) {
      await this.recordProviderFailure(records, error);
    }
  }

  private async recordSuccess(
    record: ImdbRatingCache,
    rating: MdblistImdbRating
  ): Promise<void> {
    record.imdbId = rating.imdbId ?? record.imdbId;
    record.title = rating.title ?? record.title;
    record.ratingTenths = Math.round(rating.rating * 10);
    record.voteCount = rating.votes;
    record.url = record.imdbId
      ? `https://www.imdb.com/title/${record.imdbId}`
      : record.url;
    record.source = RATING_SOURCE;
    record.missing = false;
    record.failureCount = 0;
    record.lastAttemptAt = new Date();
    record.lastSuccessAt = new Date();
    record.nextRetryAt = new Date(Date.now() + SUCCESS_REFRESH_MS);
    await getRepository(ImdbRatingCache).save(record);
    this.successes += 1;
  }

  private async recordMissing(record: ImdbRatingCache): Promise<void> {
    record.lastAttemptAt = new Date();
    record.nextRetryAt = new Date(Date.now() + MISSING_REFRESH_MS);
    record.failureCount = 0;
    if (record.ratingTenths == null || record.voteCount == null) {
      record.missing = true;
    }
    await getRepository(ImdbRatingCache).save(record);
    this.missingCount += 1;
  }

  private async recordProviderFailure(
    records: ImdbRatingCache[],
    error: unknown
  ): Promise<void> {
    const providerFailure = this.isProviderFailure(error);
    if (providerFailure) {
      this.consecutiveProviderFailures += 1;
      if (this.consecutiveProviderFailures >= PROVIDER_FAILURE_THRESHOLD) {
        this.cooldownUntil = new Date(Date.now() + PROVIDER_COOLDOWN_MS);
      }
    }

    for (const record of records) {
      record.failureCount += 1;
      record.lastAttemptAt = new Date();
      record.nextRetryAt = new Date(
        Date.now() + retryDelayMs(record.failureCount)
      );
      await getRepository(ImdbRatingCache).save(record);
      this.progress += 1;
      this.failures += 1;
    }
    logger.warn('Failed to refresh an MDBList IMDb rating batch', {
      label: 'IMDb Ratings Cache',
      mediaType: records[0]?.mediaType,
      itemCount: records.length,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      providerCooldown: this.cooldownUntil?.toISOString(),
    });
  }

  private isProviderFailure(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return true;
    const status = error.response?.status;
    return (
      !status ||
      status === 401 ||
      status === 403 ||
      status === 429 ||
      status >= 500
    );
  }

  private canRequest(): boolean {
    if (this.cooldownUntil && this.cooldownUntil.getTime() > Date.now()) {
      return false;
    }
    if (this.quota.resetAt && this.quota.resetAt.getTime() <= Date.now()) {
      this.quota = {};
    }
    return (
      this.quota.remaining == null ||
      this.quota.remaining > RATINGS_QUOTA_RESERVE
    );
  }

  private resetRun(total: number): void {
    this.cancelled = false;
    this.progress = 0;
    this.total = total;
    this.batches = 0;
    this.requests = 0;
    this.successes = 0;
    this.missingCount = 0;
    this.failures = 0;
  }

  private key(record: ImdbRatingCache): string {
    return `${record.mediaType}:${record.tmdbId}`;
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
}

const imdbRatingCache = new ImdbRatingCacheService();

export default imdbRatingCache;
