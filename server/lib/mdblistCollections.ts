import MdblistAPI, { MDBLIST_MAX_LIST_ITEMS } from '@server/api/mdblist';
import type {
  MdblistListMetadata,
  MdblistListReference,
} from '@server/api/mdblist/interfaces';
import TheMovieDb from '@server/api/themoviedb';
import { DiscoverSliderType } from '@server/constants/discover';
import { MediaStatus } from '@server/constants/media';
import dataSource, { getRepository } from '@server/datasource';
import CustomList from '@server/entity/CustomList';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import type { User } from '@server/entity/User';
import {
  MdblistProvider,
  invalidateMdblistListCache,
  type PreparedMdblistMovie,
} from '@server/lib/mdblist';
import {
  MdblistListValidationError,
  createMdblistListReference,
  parseMdblistListUrl,
} from '@server/lib/mdblistListUrl';
import { getSettings } from '@server/lib/settings';
import { createHash, randomInt } from 'node:crypto';

export const MDBLIST_COLLECTION_MAX_COUNT = 100;
export const MDBLIST_COLLECTION_MAX_TITLE_LENGTH = 100;
export const MDBLIST_COLLECTION_MAX_URL_LENGTH = 500;
export const MDBLIST_COLLECTION_MAX_METADATA_LENGTH = 10_000;

export type MdblistCollectionErrorCode =
  | 'duplicate'
  | 'invalid'
  | 'limit'
  | 'missing_api_key'
  | 'not_found';

export class MdblistCollectionError extends Error {
  constructor(
    message: string,
    public readonly code: MdblistCollectionErrorCode
  ) {
    super(message);
  }
}

export interface MdblistCollectionPreviewItem {
  tmdbId: number;
  title: string;
  releaseDate: string;
  posterPath: string;
  rank: number;
}

export interface ValidatedMdblistCollection {
  canonicalUrl: string;
  listType: 'official' | 'public';
  reference: MdblistListReference;
  mdblistId: number | null;
  sourceTitle: string;
  displayTitle: string;
  owner: string;
  slug: string;
  mediaType: 'movie';
  itemCount: number;
  usableItemCount: number;
  preview: MdblistCollectionPreviewItem[];
  movies: PreparedMdblistMovie[];
  validatedAt: Date;
}

export const mdblistCollectionSortOptions = [
  'rank',
  'random',
  'release_date.desc',
  'release_date.asc',
  'title.asc',
  'title.desc',
  'rating.desc',
  'popularity.desc',
] as const;
export type MdblistCollectionSort =
  (typeof mdblistCollectionSortOptions)[number];

export interface MdblistCollectionQuery {
  page?: number;
  sortBy?: MdblistCollectionSort;
  seed?: string;
  genre?: number;
  yearGte?: number;
  yearLte?: number;
  voteAverageGte?: number;
  mediaStatus?: MediaStatus;
  hideAvailable?: boolean;
}

interface MdblistCollectionServiceOptions {
  apiKey?: string;
  client?: MdblistAPI;
  tmdb?: TheMovieDb;
  language?: string;
}

const titleFromSlug = (slug: string): string =>
  slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const normalizeTitle = (title: string): string => {
  const normalized = title.trim();
  if (!normalized || normalized.length > MDBLIST_COLLECTION_MAX_TITLE_LENGTH) {
    throw new MdblistCollectionError(
      `Collection titles must be between 1 and ${MDBLIST_COLLECTION_MAX_TITLE_LENGTH} characters.`,
      'invalid'
    );
  }
  return normalized;
};

const serializeMetadata = (value: Record<string, unknown>): string => {
  const serialized = JSON.stringify(value);
  if (serialized.length > MDBLIST_COLLECTION_MAX_METADATA_LENGTH) {
    throw new MdblistCollectionError(
      'MDBList returned too much collection metadata.',
      'invalid'
    );
  }
  return serialized;
};

const isMovieMetadata = (metadata: MdblistListMetadata): boolean => {
  const mediaType = metadata.mediatype?.toLowerCase();
  return !mediaType || mediaType === 'movie' || mediaType === 'movies';
};

const eligibleArtwork = (movies: PreparedMdblistMovie[]) =>
  movies.filter(
    (movie): movie is PreparedMdblistMovie & { posterPath: string } =>
      Boolean(movie.posterPath)
  );

const chooseArtwork = (
  movies: PreparedMdblistMovie[],
  currentTmdbId?: number | null
): PreparedMdblistMovie | undefined => {
  const eligible = eligibleArtwork(movies);
  const alternatives = currentTmdbId
    ? eligible.filter((movie) => movie.id !== currentTmdbId)
    : eligible;
  const candidates = alternatives.length ? alternatives : eligible;
  return candidates.length
    ? candidates[randomInt(candidates.length)]
    : undefined;
};

export class MdblistCollectionService {
  private readonly apiKey: string;
  private readonly client: MdblistAPI;
  private readonly tmdb: TheMovieDb;
  private readonly language?: string;

  constructor(options: MdblistCollectionServiceOptions = {}) {
    this.apiKey = options.apiKey ?? getSettings().main.mdblistApiKey;
    this.client = options.client ?? new MdblistAPI(this.apiKey);
    this.tmdb = options.tmdb ?? new TheMovieDb();
    this.language = options.language;
  }

  public async validate(
    url: string,
    displayTitle?: string
  ): Promise<ValidatedMdblistCollection> {
    if (!this.apiKey.trim()) {
      throw new MdblistCollectionError(
        'Configure the MDBList API key in General settings first.',
        'missing_api_key'
      );
    }
    if (!url.trim() || url.trim().length > MDBLIST_COLLECTION_MAX_URL_LENGTH) {
      throw new MdblistCollectionError(
        'Invalid MDBList collection URL.',
        'invalid'
      );
    }

    let parsed: ReturnType<typeof parseMdblistListUrl>;
    try {
      parsed = parseMdblistListUrl(url);
    } catch (error) {
      throw new MdblistCollectionError(
        error instanceof MdblistListValidationError
          ? error.message
          : 'Invalid MDBList collection URL.',
        'invalid'
      );
    }
    if (parsed.mediaType === 'tv') {
      throw new MdblistCollectionError(
        'Only public MDBList movie lists are supported as collections.',
        'invalid'
      );
    }

    let metadata: MdblistListMetadata;
    try {
      metadata = await this.client.getListMetadata(parsed.reference);
    } catch {
      throw new MdblistCollectionError(
        'The MDBList collection was not found or is not accessible.',
        'invalid'
      );
    }
    if (metadata.private) {
      throw new MdblistCollectionError(
        'Private MDBList lists are not supported.',
        'invalid'
      );
    }
    if (!isMovieMetadata(metadata)) {
      throw new MdblistCollectionError(
        'Only MDBList movie lists are supported as collections.',
        'invalid'
      );
    }
    if ((metadata.items ?? 0) > MDBLIST_MAX_LIST_ITEMS) {
      throw new MdblistCollectionError(
        `MDBList collections are limited to ${MDBLIST_MAX_LIST_ITEMS} source items.`,
        'limit'
      );
    }

    const provider = new MdblistProvider({
      apiKey: this.apiKey,
      client: this.client,
      list: parsed.reference,
      mediaType: 'movie',
    });
    const movies = await provider.getPreparedCollection({
      tmdb: this.tmdb,
      language: this.language,
    });
    const sourceTitle =
      metadata.name?.trim() || titleFromSlug(parsed.reference.slug);
    const normalizedDisplayTitle = displayTitle
      ? normalizeTitle(displayTitle)
      : sourceTitle.slice(0, MDBLIST_COLLECTION_MAX_TITLE_LENGTH);
    const preview = eligibleArtwork(movies)
      .slice(0, 5)
      .map((movie) => ({
        tmdbId: movie.id,
        title: movie.title,
        releaseDate: movie.releaseDate,
        posterPath: movie.posterPath,
        rank: movie.mdblistRank,
      }));

    return {
      canonicalUrl: parsed.canonicalUrl,
      listType: parsed.listType,
      reference: parsed.reference,
      mdblistId: metadata.id ?? null,
      sourceTitle,
      displayTitle: normalizedDisplayTitle,
      owner:
        parsed.reference.type === 'public'
          ? parsed.reference.username
          : 'official',
      slug: parsed.reference.slug,
      mediaType: 'movie',
      itemCount: metadata.items ?? movies.length,
      usableItemCount: movies.length,
      preview,
      movies,
      validatedAt: new Date(),
    };
  }

  public async create(input: {
    url: string;
    title?: string;
  }): Promise<CustomList> {
    const repository = getRepository(CustomList);
    if (
      (await repository.count({
        where: { provider: 'mdblist', mediaType: 'movie' },
      })) >= MDBLIST_COLLECTION_MAX_COUNT
    ) {
      throw new MdblistCollectionError(
        `A maximum of ${MDBLIST_COLLECTION_MAX_COUNT} MDBList collections may be configured.`,
        'limit'
      );
    }

    const validated = await this.validate(input.url, input.title);
    await this.assertUnique(validated.reference);
    const artwork = chooseArtwork(validated.movies);
    const maximum = await repository
      .createQueryBuilder('list')
      .select('MAX(list.sortOrder)', 'max')
      .where('list.mediaType = :mediaType', { mediaType: 'movie' })
      .getRawOne<{ max: number | null }>();

    return repository.save(
      new CustomList({
        provider: 'mdblist',
        listType: validated.listType,
        title: validated.displayTitle,
        sourceUrl: validated.canonicalUrl,
        username: validated.owner === 'official' ? '' : validated.owner,
        slug: validated.slug,
        mediaType: 'movie',
        itemCount: validated.itemCount,
        enabled: true,
        sortOrder: Number(maximum?.max ?? -1) + 1,
        mdblistId: validated.mdblistId,
        selectedArtworkTmdbId: artwork?.id ?? null,
        selectedArtworkPosterPath: artwork?.posterPath ?? null,
        lastValidatedAt: validated.validatedAt,
        metadata: this.metadataFor(validated),
      })
    );
  }

  public async update(
    id: number,
    input: { title?: string; url?: string }
  ): Promise<CustomList> {
    const repository = getRepository(CustomList);
    const list = await this.getMovieCollection(id);
    if (input.url && input.url.trim() !== list.sourceUrl) {
      const oldReference = createMdblistListReference(list);
      const validated = await this.validate(
        input.url,
        input.title ?? list.title
      );
      await this.assertUnique(validated.reference, list.id);
      const artwork = chooseArtwork(validated.movies);
      list.listType = validated.listType;
      list.sourceUrl = validated.canonicalUrl;
      list.username = validated.owner === 'official' ? '' : validated.owner;
      list.slug = validated.slug;
      list.title = validated.displayTitle;
      list.itemCount = validated.itemCount;
      list.mdblistId = validated.mdblistId;
      list.selectedArtworkTmdbId = artwork?.id ?? null;
      list.selectedArtworkPosterPath = artwork?.posterPath ?? null;
      list.lastValidatedAt = validated.validatedAt;
      list.metadata = this.metadataFor(validated);
      invalidateMdblistListCache(oldReference);
    } else if (input.title !== undefined) {
      list.title = normalizeTitle(input.title);
    }
    return repository.save(list);
  }

  public async setEnabled(id: number, enabled: boolean): Promise<CustomList> {
    const list = await this.getMovieCollection(id);
    list.enabled = enabled;
    return getRepository(CustomList).save(list);
  }

  public async reorder(ids: number[]): Promise<CustomList[]> {
    if (
      ids.length > MDBLIST_COLLECTION_MAX_COUNT ||
      new Set(ids).size !== ids.length
    ) {
      throw new MdblistCollectionError('Invalid collection order.', 'invalid');
    }
    const current = await getRepository(CustomList).find({
      where: { provider: 'mdblist', mediaType: 'movie' },
    });
    if (
      current.length !== ids.length ||
      current.some((list) => !ids.includes(list.id))
    ) {
      throw new MdblistCollectionError(
        'Collection order must include every movie collection exactly once.',
        'invalid'
      );
    }

    await dataSource.transaction(async (manager) => {
      for (const [sortOrder, id] of ids.entries()) {
        await manager.getRepository(CustomList).update({ id }, { sortOrder });
      }
    });
    return getRepository(CustomList).find({
      where: { provider: 'mdblist', mediaType: 'movie' },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  public async delete(id: number): Promise<void> {
    const list = await this.getMovieCollection(id);
    await dataSource.transaction(async (manager) => {
      await manager.getRepository(DiscoverSlider).delete({
        type: DiscoverSliderType.MDBLIST_CUSTOM_MOVIES,
        data: String(id),
      });
      await manager.getRepository(CustomList).remove(list);
    });
    invalidateMdblistListCache(createMdblistListReference(list));
  }

  public async shuffleArtwork(id: number): Promise<CustomList> {
    const list = await this.getMovieCollection(id);
    const provider = this.providerFor(list);
    const movies = await provider.getPreparedCollection({
      tmdb: this.tmdb,
      language: this.language,
    });
    const artwork = chooseArtwork(movies, list.selectedArtworkTmdbId);
    list.selectedArtworkTmdbId = artwork?.id ?? null;
    list.selectedArtworkPosterPath = artwork?.posterPath ?? null;
    return getRepository(CustomList).save(list);
  }

  public async refresh(id: number): Promise<CustomList> {
    const list = await this.getMovieCollection(id);
    const reference = createMdblistListReference(list);
    invalidateMdblistListCache(reference);
    const validated = await this.validate(list.sourceUrl, list.title);
    const selectedStillExists = validated.movies.find(
      (movie) =>
        movie.id === list.selectedArtworkTmdbId && Boolean(movie.posterPath)
    );
    const artwork = selectedStillExists ?? chooseArtwork(validated.movies);
    list.itemCount = validated.itemCount;
    list.mdblistId = validated.mdblistId;
    list.lastValidatedAt = validated.validatedAt;
    list.metadata = this.metadataFor(validated);
    list.selectedArtworkTmdbId = artwork?.id ?? null;
    list.selectedArtworkPosterPath = artwork?.posterPath ?? null;
    return getRepository(CustomList).save(list);
  }

  public async getCollectionPage({
    id,
    user,
    query,
    allowDisabled = false,
  }: {
    id: number;
    user?: User;
    query: MdblistCollectionQuery;
    allowDisabled?: boolean;
  }) {
    const list = await this.getMovieCollection(id);
    if (!list.enabled && !allowDisabled) {
      throw new MdblistCollectionError(
        'MDBList collection not found.',
        'not_found'
      );
    }
    const provider = this.providerFor(list);
    let movies = (await provider.getStreamingChart({
      tmdb: this.tmdb,
      user,
      language: this.language,
    })) as PreparedMdblistMovie[];

    if (query.genre) {
      movies = movies.filter((movie) => movie.genreIds.includes(query.genre!));
    }
    if (query.yearGte) {
      movies = movies.filter(
        (movie) => Number(movie.releaseDate?.slice(0, 4)) >= query.yearGte!
      );
    }
    if (query.yearLte) {
      movies = movies.filter(
        (movie) => Number(movie.releaseDate?.slice(0, 4)) <= query.yearLte!
      );
    }
    if (query.voteAverageGte !== undefined) {
      movies = movies.filter(
        (movie) => movie.voteAverage >= query.voteAverageGte!
      );
    }
    if (query.mediaStatus !== undefined) {
      movies = movies.filter(
        (movie) => movie.mediaInfo?.status === query.mediaStatus
      );
    }
    if (query.hideAvailable) {
      movies = movies.filter(
        (movie) =>
          movie.mediaInfo?.status !== MediaStatus.AVAILABLE &&
          movie.mediaInfo?.status !== MediaStatus.PARTIALLY_AVAILABLE
      );
    }

    const sortBy = query.sortBy ?? 'rank';
    const direction = sortBy.endsWith('.asc') ? 1 : -1;
    movies = [...movies].sort((left, right) => {
      let comparison = 0;
      switch (sortBy) {
        case 'random': {
          const seed = query.seed ?? '';
          comparison = this.seededValue(seed, left.id).localeCompare(
            this.seededValue(seed, right.id)
          );
          break;
        }
        case 'release_date.asc':
        case 'release_date.desc':
          comparison = left.releaseDate.localeCompare(right.releaseDate);
          break;
        case 'title.asc':
        case 'title.desc':
          comparison = left.title.localeCompare(right.title);
          break;
        case 'rating.desc':
          comparison = left.voteAverage - right.voteAverage;
          break;
        case 'popularity.desc':
          comparison = left.popularity - right.popularity;
          break;
        default:
          return left.mdblistRank - right.mdblistRank || left.id - right.id;
      }
      return comparison * direction || left.mdblistRank - right.mdblistRank;
    });

    const page = Math.max(1, Math.floor(query.page ?? 1));
    const pageSize = 20;
    return {
      page,
      totalPages: Math.max(1, Math.ceil(movies.length / pageSize)),
      totalResults: movies.length,
      results: movies.slice((page - 1) * pageSize, page * pageSize),
      title: list.title,
      itemCount: list.itemCount,
      sourceUrl: list.sourceUrl,
    };
  }

  private providerFor(list: CustomList): MdblistProvider {
    return new MdblistProvider({
      apiKey: this.apiKey,
      client: this.client,
      list: createMdblistListReference(list),
      mediaType: 'movie',
    });
  }

  private async getMovieCollection(id: number): Promise<CustomList> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new MdblistCollectionError(
        'MDBList collection not found.',
        'not_found'
      );
    }
    const list = await getRepository(CustomList).findOne({
      where: { id, provider: 'mdblist', mediaType: 'movie' },
    });
    if (!list) {
      throw new MdblistCollectionError(
        'MDBList collection not found.',
        'not_found'
      );
    }
    return list;
  }

  private async assertUnique(
    reference: MdblistListReference,
    excludeId?: number
  ): Promise<void> {
    const existing = await getRepository(CustomList).findOne({
      where: {
        provider: 'mdblist',
        listType: reference.type,
        username: reference.type === 'public' ? reference.username : '',
        slug: reference.slug,
        mediaType: 'movie',
      },
    });
    if (existing && existing.id !== excludeId) {
      throw new MdblistCollectionError(
        'This MDBList collection already exists.',
        'duplicate'
      );
    }
  }

  private metadataFor(validated: ValidatedMdblistCollection): string {
    return serializeMetadata({
      sourceTitle: validated.sourceTitle,
      owner: validated.owner,
      slug: validated.slug,
      listId: validated.mdblistId,
      mediaType: validated.mediaType,
      itemCount: validated.itemCount,
      usableItemCount: validated.usableItemCount,
      preview: validated.preview,
    });
  }

  private seededValue(seed: string, tmdbId: number): string {
    return createHash('sha256').update(`${seed}:${tmdbId}`).digest('hex');
  }
}
