import MdblistAPI from '@server/api/mdblist';
import type {
  MdblistListReference,
  MdblistMovieItem,
  MdblistShowItem,
} from '@server/api/mdblist/interfaces';
import type TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import Media from '@server/entity/Media';
import type { User } from '@server/entity/User';
import cacheManager from '@server/lib/cache';
import { getMdblistReferenceKey } from '@server/lib/mdblistListUrl';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { MovieResult, TvResult } from '@server/models/Search';
import {
  mapMovieDetailsToResult,
  mapMovieResult,
  mapTvDetailsToResult,
  mapTvResult,
} from '@server/models/Search';
import { createHash } from 'node:crypto';

export const JUSTWATCH_STREAMING_CHART_SLUG =
  'justwatch-streaming-charts' as const;
export const MDBLIST_SOURCE_LIMIT = 10_000;
export const MDBLIST_PAGE_SIZE = 20;
export const MDBLIST_CACHE_TTL_SECONDS = 3 * 60 * 60;
export const MDBLIST_STALE_TTL_SECONDS = 24 * 60 * 60;
export const MDBLIST_FAILURE_TTL_SECONDS = 5 * 60;

const DEFAULT_LIST_REFERENCE: MdblistListReference = {
  type: 'official',
  slug: JUSTWATCH_STREAMING_CHART_SLUG,
};

export interface RankedMovieResult extends MovieResult {
  mdblistRank: number;
}
export interface RankedTvResult extends TvResult {
  mdblistRank: number;
}

export interface RankedMoviePage {
  page: number;
  totalPages: number;
  totalResults: number;
  results: RankedMovieResult[];
}

type MdblistMediaItem = MdblistMovieItem | MdblistShowItem;
type RankedMediaResult = RankedMovieResult | RankedTvResult;

interface RankedMovieIdentifier {
  item: MdblistMediaItem;
  tmdbId: number;
}

interface PreparedRankedMovie {
  item: MdblistMediaItem;
  movie: MovieResult | TvResult;
}

export interface PreparedMdblistMovie extends MovieResult {
  mdblistRank: number;
}

interface MdblistSourceClient {
  getMovieList?(options: {
    reference: MdblistListReference;
    limit: number;
  }): Promise<MdblistMovieItem[]>;
  getShowList?(options: {
    reference: MdblistListReference;
    limit: number;
  }): Promise<MdblistShowItem[]>;
  getOfficialMovieList?(options: {
    slug: string;
    limit: number;
  }): Promise<MdblistMovieItem[]>;
}

interface MdblistLogger {
  warn(message: string, metadata?: Record<string, unknown>): void;
}

interface MdblistProviderOptions {
  apiKey?: string;
  client?: MdblistSourceClient;
  log?: MdblistLogger;
  list?: MdblistListReference;
  mediaType?: 'movie' | 'tv';
}

const sourceRefreshPromises = new Map<string, Promise<MdblistMediaItem[]>>();
const normalizedRefreshPromises = new Map<
  string,
  Promise<RankedMovieIdentifier[]>
>();
const preparedRefreshPromises = new Map<
  string,
  Promise<PreparedRankedMovie[]>
>();

export class MdblistProvider {
  private apiKey: string;
  private client?: MdblistSourceClient;
  private log: MdblistLogger;
  private list: MdblistListReference;
  private mediaType: 'movie' | 'tv';
  private cache = cacheManager.getCache('mdblist').data;

  constructor(options: MdblistProviderOptions = {}) {
    this.apiKey = options.apiKey ?? getSettings().main.mdblistApiKey;
    this.client = options.client;
    this.log = options.log ?? logger;
    this.list = options.list ?? DEFAULT_LIST_REFERENCE;
    this.mediaType = options.mediaType ?? 'movie';
  }

  private get freshCacheKey(): string {
    return `${getMdblistReferenceKey(this.list)}:${this.mediaType}`;
  }

  private get staleCacheKey(): string {
    return `${this.freshCacheKey}:stale`;
  }

  public isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  public async getSourceItems(): Promise<MdblistMediaItem[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const cached = this.cache.get<MdblistMediaItem[]>(this.freshCacheKey);
    if (cached) {
      return cached;
    }

    let refreshPromise = sourceRefreshPromises.get(this.freshCacheKey);
    if (!refreshPromise) {
      refreshPromise = this.refreshSourceItems().finally(() => {
        sourceRefreshPromises.delete(this.freshCacheKey);
      });
      sourceRefreshPromises.set(this.freshCacheKey, refreshPromise);
    }

    return refreshPromise;
  }

  private async refreshSourceItems(): Promise<MdblistMediaItem[]> {
    try {
      const client = this.client ?? new MdblistAPI(this.apiKey);
      const items =
        this.mediaType === 'tv' && client.getShowList
          ? await client.getShowList({
              reference: this.list,
              limit: MDBLIST_SOURCE_LIMIT,
            })
          : client.getMovieList
            ? await client.getMovieList({
                reference: this.list,
                limit: MDBLIST_SOURCE_LIMIT,
              })
            : this.list.type === 'official' && client.getOfficialMovieList
              ? await client.getOfficialMovieList({
                  slug: this.list.slug,
                  limit: MDBLIST_SOURCE_LIMIT,
                })
              : [];

      this.cache.set(this.freshCacheKey, items, MDBLIST_CACHE_TTL_SECONDS);
      this.cache.set(this.staleCacheKey, items, MDBLIST_STALE_TTL_SECONDS);
      return items;
    } catch (error) {
      const stale = this.cache.get<MdblistMediaItem[]>(this.staleCacheKey);
      this.cache.set(
        this.freshCacheKey,
        stale ?? [],
        MDBLIST_FAILURE_TTL_SECONDS
      );
      this.log.warn('MDBList chart refresh failed', {
        label: 'MDBList',
        errorType:
          error instanceof Error ? error.constructor.name : 'UnknownError',
        servingStale: Boolean(stale),
      });
      return stale ?? [];
    }
  }

  public async getStreamingChart({
    tmdb,
    user,
    language,
  }: {
    tmdb: TheMovieDb;
    user?: User;
    language?: string;
  }): Promise<RankedMediaResult[]> {
    const rankedItems = await this.getPreparedRankedMovies({
      tmdb,
      language,
    });

    return this.attachRelatedMedia({
      rankedItems,
      user,
    });
  }

  public async getPreparedCollection({
    tmdb,
    language,
  }: {
    tmdb: TheMovieDb;
    language?: string;
  }): Promise<PreparedMdblistMovie[]> {
    if (this.mediaType !== 'movie') {
      return [];
    }

    const prepared = await this.getPreparedRankedMovies({ tmdb, language });
    return prepared.map(({ item, movie }) => ({
      ...(movie as MovieResult),
      mdblistRank: item.rank,
    }));
  }

  public async getStreamingChartPage({
    tmdb,
    user,
    language,
    page = 1,
    pageSize = MDBLIST_PAGE_SIZE,
  }: {
    tmdb: TheMovieDb;
    user?: User;
    language?: string;
    page?: number;
    pageSize?: number;
  }): Promise<
    Omit<RankedMoviePage, 'results'> & { results: RankedMediaResult[] }
  > {
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedPageSize = Math.max(1, Math.floor(pageSize));
    const rankedItems = await this.getPreparedRankedMovies({
      tmdb,
      language,
    });
    const pageStart = (normalizedPage - 1) * normalizedPageSize;
    const pageItems = rankedItems.slice(
      pageStart,
      pageStart + normalizedPageSize
    );
    const results = await this.attachRelatedMedia({
      rankedItems: pageItems,
      user,
    });

    return {
      page: normalizedPage,
      totalPages: Math.max(
        1,
        Math.ceil(rankedItems.length / normalizedPageSize)
      ),
      totalResults: rankedItems.length,
      results,
    };
  }

  private async getRankedMovieIdentifiers({
    tmdb,
    language,
  }: {
    tmdb: TheMovieDb;
    language?: string;
  }): Promise<RankedMovieIdentifier[]> {
    const sourceItems = await this.getSourceItems();
    const sourceRevision = createHash('sha256')
      .update(JSON.stringify(sourceItems))
      .digest('hex');
    const cacheKey = `normalized:${getMdblistReferenceKey(this.list)}:${
      language ?? 'default'
    }:${sourceRevision}`;
    const cached = this.cache.get<RankedMovieIdentifier[]>(cacheKey);
    if (cached) {
      return cached;
    }

    let refreshPromise = normalizedRefreshPromises.get(cacheKey);
    if (!refreshPromise) {
      refreshPromise = this.resolveRankedMovieIdentifiers({
        sourceItems,
        tmdb,
        language,
      });
      normalizedRefreshPromises.set(cacheKey, refreshPromise);
    }

    try {
      const rankedItems = await refreshPromise;
      this.cache.set(cacheKey, rankedItems, MDBLIST_CACHE_TTL_SECONDS);
      return rankedItems;
    } finally {
      normalizedRefreshPromises.delete(cacheKey);
    }
  }

  private async resolveRankedMovieIdentifiers({
    sourceItems,
    tmdb,
    language,
  }: {
    sourceItems: MdblistMediaItem[];
    tmdb: TheMovieDb;
    language?: string;
  }): Promise<RankedMovieIdentifier[]> {
    const rankedItems = sourceItems
      .map((item, sourceIndex) => ({ item, sourceIndex }))
      .filter(({ item }) => item.adult === 0)
      .sort(
        (left, right) =>
          left.item.rank - right.item.rank ||
          left.sourceIndex - right.sourceIndex
      );

    const resolvedIds = await Promise.all(
      rankedItems.map(async ({ item }) => ({
        item,
        tmdbId: await this.resolveTmdbId(item, tmdb, language),
      }))
    );

    const seenTmdbIds = new Set<number>();
    return resolvedIds.filter((entry): entry is RankedMovieIdentifier => {
      if (!entry.tmdbId || seenTmdbIds.has(entry.tmdbId)) {
        return false;
      }
      seenTmdbIds.add(entry.tmdbId);
      return true;
    });
  }

  private async getPreparedRankedMovies({
    tmdb,
    language,
  }: {
    tmdb: TheMovieDb;
    language?: string;
  }): Promise<PreparedRankedMovie[]> {
    const rankedItems = await this.getRankedMovieIdentifiers({
      tmdb,
      language,
    });
    const revision = createHash('sha256')
      .update(
        JSON.stringify(
          rankedItems.map(({ item, tmdbId }) => ({
            rank: item.rank,
            tmdbId,
          }))
        )
      )
      .digest('hex');
    const cacheKey = `prepared:${getMdblistReferenceKey(this.list)}:${
      language ?? 'default'
    }:${revision}`;
    const cached = this.cache.get<PreparedRankedMovie[]>(cacheKey);
    if (cached) {
      return cached;
    }

    let refreshPromise = preparedRefreshPromises.get(cacheKey);
    if (!refreshPromise) {
      refreshPromise = this.prepareRankedMovies({
        rankedItems,
        tmdb,
        language,
      });
      preparedRefreshPromises.set(cacheKey, refreshPromise);
    }

    try {
      const prepared = await refreshPromise;
      this.cache.set(
        cacheKey,
        prepared,
        prepared.length === rankedItems.length
          ? MDBLIST_CACHE_TTL_SECONDS
          : MDBLIST_FAILURE_TTL_SECONDS
      );
      return prepared;
    } finally {
      preparedRefreshPromises.delete(cacheKey);
    }
  }

  private async prepareRankedMovies({
    rankedItems,
    tmdb,
    language,
  }: {
    rankedItems: RankedMovieIdentifier[];
    tmdb: TheMovieDb;
    language?: string;
  }): Promise<PreparedRankedMovie[]> {
    const hydrated = await Promise.all(
      rankedItems.map(async ({ item, tmdbId }) => {
        try {
          if (this.mediaType === 'tv') {
            const show = await tmdb.getTvShow({ tvId: tmdbId, language });
            return { item, movie: mapTvResult(mapTvDetailsToResult(show)) };
          }
          const movie = await tmdb.getMovie({ movieId: tmdbId, language });
          return movie.adult
            ? undefined
            : { item, movie: mapMovieResult(mapMovieDetailsToResult(movie)) };
        } catch (error) {
          this.log.warn('MDBList item could not be hydrated', {
            label: 'MDBList',
            list: getMdblistReferenceKey(this.list),
            rank: item.rank,
            tmdbId,
            errorType:
              error instanceof Error ? error.constructor.name : 'UnknownError',
          });
          return undefined;
        }
      })
    );

    return hydrated.filter((entry): entry is NonNullable<typeof entry> =>
      Boolean(entry)
    );
  }

  private async attachRelatedMedia({
    rankedItems,
    user,
  }: {
    rankedItems: PreparedRankedMovie[];
    user?: User;
  }): Promise<RankedMediaResult[]> {
    const relatedMedia = await Media.getRelatedMedia(
      user,
      rankedItems.map(({ movie }) => ({
        tmdbId: movie.id,
        mediaType: this.mediaType === 'movie' ? MediaType.MOVIE : MediaType.TV,
      }))
    );

    return rankedItems.map(({ item, movie }) => ({
      ...movie,
      mediaInfo: relatedMedia.find(
        (media) =>
          media.tmdbId === movie.id &&
          media.mediaType ===
            (this.mediaType === 'movie' ? MediaType.MOVIE : MediaType.TV)
      ),
      mdblistRank: item.rank,
    }));
  }

  private async resolveTmdbId(
    item: MdblistMediaItem,
    tmdb: TheMovieDb,
    language?: string
  ): Promise<number | undefined> {
    if (item.ids.tmdb) {
      return item.ids.tmdb;
    }

    const imdbId = item.ids.imdb ?? item.imdb_id;
    const tvdbId = this.mediaType === 'tv' ? item.ids.tvdb : undefined;
    if (!imdbId && !tvdbId) {
      this.log.warn('MDBList item has no supported external identifier', {
        label: 'MDBList',
        rank: item.rank,
      });
      return undefined;
    }

    try {
      const response = await tmdb.getByExternalId({
        ...(imdbId
          ? { externalId: imdbId, type: 'imdb' as const }
          : { externalId: tvdbId as number, type: 'tvdb' as const }),
        language,
      });
      const tmdbId =
        this.mediaType === 'tv'
          ? response.tv_results[0]?.id
          : response.movie_results[0]?.id;
      if (!tmdbId) {
        this.log.warn(
          'MDBList external identifier returned no matching media',
          {
            label: 'MDBList',
            rank: item.rank,
          }
        );
      }
      return tmdbId;
    } catch (error) {
      this.log.warn('MDBList external identifier could not be resolved', {
        label: 'MDBList',
        rank: item.rank,
        errorType:
          error instanceof Error ? error.constructor.name : 'UnknownError',
      });
      return undefined;
    }
  }
}

export const resetMdblistProviderStateForTests = (): void => {
  sourceRefreshPromises.clear();
  normalizedRefreshPromises.clear();
  preparedRefreshPromises.clear();
  cacheManager.getCache('mdblist').flush();
};

export const invalidateMdblistListCache = (
  list: MdblistListReference,
  mediaType: 'movie' | 'tv' = 'movie'
): void => {
  const referenceKey = getMdblistReferenceKey(list);
  const sourceKey = `${referenceKey}:${mediaType}`;
  const cache = cacheManager.getCache('mdblist').data;

  cache.keys().forEach((key) => {
    if (key.includes(referenceKey)) {
      cache.del(key);
    }
  });
  sourceRefreshPromises.delete(sourceKey);
  [...normalizedRefreshPromises.keys()]
    .filter((key) => key.includes(referenceKey))
    .forEach((key) => normalizedRefreshPromises.delete(key));
  [...preparedRefreshPromises.keys()]
    .filter((key) => key.includes(referenceKey))
    .forEach((key) => preparedRefreshPromises.delete(key));
};
