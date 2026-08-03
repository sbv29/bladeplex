import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import type {
  MdblistMovieItem,
  MdblistShowItem,
} from '@server/api/mdblist/interfaces';
import {
  MdblistListItemsResponseSchema,
  MdblistListMetadataSchema,
} from '@server/api/mdblist/interfaces';
import type TheMovieDb from '@server/api/themoviedb';
import Media from '@server/entity/Media';
import cacheManager from '@server/lib/cache';
import {
  MdblistProvider,
  invalidateMdblistListCache,
  resetMdblistProviderStateForTests,
} from '@server/lib/mdblist';

const sourceMovie = (
  rank: number,
  tmdbId?: number,
  imdbId?: string
): MdblistMovieItem => ({
  rank,
  adult: 0,
  ids: { tmdb: tmdbId, imdb: imdbId, tvdb: null },
  mediatype: 'movie',
});

const movieDetails = (id: number) =>
  ({
    id,
    adult: false,
    genres: [],
    original_language: 'en',
    original_title: `Movie ${id}`,
    overview: '',
    popularity: 1,
    release_date: '2026-01-01',
    title: `Movie ${id}`,
    video: false,
    vote_average: 7,
    vote_count: 10,
    backdrop_path: null,
    poster_path: `/movie-${id}.jpg`,
  }) as unknown as Awaited<ReturnType<TheMovieDb['getMovie']>>;

const sourceShow = (rank: number, tmdbId: number): MdblistShowItem => ({
  rank,
  adult: 0,
  ids: { tmdb: tmdbId, imdb: null, tvdb: null },
  mediatype: 'show',
});

const showDetails = (id: number) =>
  ({
    id,
    first_air_date: '2026-01-01',
    genres: [],
    name: `Show ${id}`,
    origin_country: ['US'],
    original_language: 'en',
    original_name: `Show ${id}`,
    overview: '',
    popularity: 1,
    vote_average: 8,
    vote_count: 20,
    backdrop_path: null,
    poster_path: `/show-${id}.jpg`,
  }) as unknown as Awaited<ReturnType<TheMovieDb['getTvShow']>>;

const createTmdb = ({
  imdbResults = {},
  failingIds = [],
}: {
  imdbResults?: Record<string, number>;
  failingIds?: number[];
} = {}) =>
  ({
    getByExternalId: async ({ externalId }: { externalId: string }) => ({
      movie_results: imdbResults[externalId]
        ? [{ id: imdbResults[externalId] }]
        : [],
    }),
    getMovie: async ({ movieId }: { movieId: number }) => {
      if (failingIds.includes(movieId)) {
        throw new Error('TMDb unavailable');
      }
      return movieDetails(movieId);
    },
  }) as unknown as TheMovieDb;

beforeEach(() => {
  resetMdblistProviderStateForTests();
  mock.method(Media, 'getRelatedMedia', async () => []);
});

afterEach(() => {
  mock.restoreAll();
});

describe('MdblistProvider', () => {
  it('accepts documented and observed public-list metadata responses', () => {
    const metadata = {
      id: 14,
      name: 'Top Watched Movies of The Week / >60',
      slug: 'top-watched-movies-of-the-week',
      private: false,
      mediatype: 'movie',
      user_name: 'linaspurinis',
      items: 50,
    };

    assert.deepEqual(MdblistListMetadataSchema.parse(metadata), metadata);
    assert.deepEqual(MdblistListMetadataSchema.parse([metadata]), metadata);
    assert.throws(() => MdblistListMetadataSchema.parse([]));
  });

  it('maps movies by stable IDs while preserving rank and first-occurrence order', async () => {
    const provider = new MdblistProvider({
      apiKey: 'configured',
      client: {
        getOfficialMovieList: async () => [
          sourceMovie(3, 30),
          sourceMovie(1, 10),
          sourceMovie(2, undefined, 'tt0000020'),
          sourceMovie(4, 10),
        ],
      },
    });

    const results = await provider.getStreamingChart({
      tmdb: createTmdb({ imdbResults: { tt0000020: 20 } }),
    });

    assert.deepEqual(
      results.map(({ id, mdblistRank }) => ({ id, mdblistRank })),
      [
        { id: 10, mdblistRank: 1 },
        { id: 20, mdblistRank: 2 },
        { id: 30, mdblistRank: 3 },
      ]
    );
  });

  it('fetches and hydrates ranked TV shows', async () => {
    const provider = new MdblistProvider({
      apiKey: 'configured',
      mediaType: 'tv',
      list: { type: 'official', slug: 'moviemeter' },
      client: {
        getShowList: async () => [sourceShow(2, 20), sourceShow(1, 10)],
      },
    });
    const tmdb = {
      getTvShow: async ({ tvId }: { tvId: number }) => showDetails(tvId),
    } as unknown as TheMovieDb;

    const results = await provider.getStreamingChart({ tmdb });
    assert.deepEqual(
      results.map(({ id, mediaType, mdblistRank }) => ({
        id,
        mediaType,
        mdblistRank,
      })),
      [
        { id: 10, mediaType: 'tv', mdblistRank: 1 },
        { id: 20, mediaType: 'tv', mdblistRank: 2 },
      ]
    );
  });

  it('omits unresolved and unhydratable items without disturbing other ranks', async () => {
    const provider = new MdblistProvider({
      apiKey: 'configured',
      client: {
        getOfficialMovieList: async () => [
          sourceMovie(1, 10),
          sourceMovie(2, undefined, 'tt-unresolved'),
          sourceMovie(3, 30),
        ],
      },
    });

    const results = await provider.getStreamingChart({
      tmdb: createTmdb({ failingIds: [30] }),
    });

    assert.deepEqual(
      results.map((result) => result.id),
      [10]
    );
  });

  it('returns no items without an API key and never calls the client', async () => {
    let calls = 0;
    const provider = new MdblistProvider({
      apiKey: '',
      client: {
        getOfficialMovieList: async () => {
          calls += 1;
          return [sourceMovie(1, 10)];
        },
      },
    });

    assert.deepEqual(await provider.getSourceItems(), []);
    assert.equal(calls, 0);
  });

  it('reuses the shared cache and deduplicates simultaneous refreshes', async () => {
    let calls = 0;
    const client = {
      getOfficialMovieList: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return [sourceMovie(1, 10)];
      },
    };
    const provider = new MdblistProvider({ apiKey: 'configured', client });

    const [first, second] = await Promise.all([
      provider.getSourceItems(),
      provider.getSourceItems(),
    ]);
    const third = await new MdblistProvider({
      apiKey: 'configured',
      client,
    }).getSourceItems();

    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    assert.deepEqual(second, third);
  });

  it('paginates the complete cached chart locally without another MDBList request', async () => {
    let calls = 0;
    let requestedLimit = 0;
    const hydratedIds: number[] = [];
    const client = {
      getOfficialMovieList: async ({ limit }: { limit: number }) => {
        calls += 1;
        requestedLimit = limit;
        return Array.from({ length: 45 }, (_, index) =>
          sourceMovie(index + 1, index + 1)
        );
      },
    };
    const tmdb = createTmdb();
    mock.method(tmdb, 'getMovie', async ({ movieId }: { movieId: number }) => {
      hydratedIds.push(movieId);
      return movieDetails(movieId);
    });
    const provider = new MdblistProvider({ apiKey: 'configured', client });

    const firstPage = await provider.getStreamingChartPage({ tmdb, page: 1 });
    const secondPage = await provider.getStreamingChartPage({ tmdb, page: 2 });
    const lastPage = await provider.getStreamingChartPage({ tmdb, page: 3 });

    assert.equal(calls, 1);
    assert.equal(requestedLimit, 10_000);
    assert.equal(firstPage.totalResults, 45);
    assert.equal(firstPage.totalPages, 3);
    assert.deepEqual(
      firstPage.results.map((result) => result.mdblistRank),
      Array.from({ length: 20 }, (_, index) => index + 1)
    );
    assert.deepEqual(
      secondPage.results.map((result) => result.mdblistRank),
      Array.from({ length: 20 }, (_, index) => index + 21)
    );
    assert.deepEqual(
      lastPage.results.map((result) => result.mdblistRank),
      [41, 42, 43, 44, 45]
    );
    assert.deepEqual(
      hydratedIds,
      Array.from({ length: 45 }, (_, index) => index + 1)
    );
  });

  it('paginates after hydration so failures do not create gaps or inflate totals', async () => {
    let sourceCalls = 0;
    const provider = new MdblistProvider({
      apiKey: 'configured',
      client: {
        getOfficialMovieList: async () => {
          sourceCalls += 1;
          return Array.from({ length: 45 }, (_, index) =>
            sourceMovie(index + 1, index + 1)
          );
        },
      },
    });
    const tmdb = createTmdb({ failingIds: [5] });

    const firstPage = await provider.getStreamingChartPage({ tmdb, page: 1 });
    const secondPage = await provider.getStreamingChartPage({ tmdb, page: 2 });
    const thirdPage = await provider.getStreamingChartPage({ tmdb, page: 3 });

    assert.equal(sourceCalls, 1);
    assert.equal(firstPage.totalResults, 44);
    assert.equal(firstPage.totalPages, 3);
    assert.equal(firstPage.results.length, 20);
    assert.deepEqual(
      firstPage.results.map((result) => result.mdblistRank),
      [1, 2, 3, 4, ...Array.from({ length: 16 }, (_, index) => index + 6)]
    );
    assert.equal(secondPage.results.length, 20);
    assert.deepEqual(
      thirdPage.results.map((result) => result.mdblistRank),
      [42, 43, 44, 45]
    );
  });

  it('keeps source caches isolated for each custom list', async () => {
    const calls: string[] = [];
    const client = {
      getMovieList: async ({
        reference,
      }: {
        reference:
          | { type: 'official'; slug: string }
          | { type: 'public'; username: string; slug: string };
      }) => {
        const key =
          reference.type === 'official'
            ? `official:${reference.slug}`
            : `public:${reference.username}/${reference.slug}`;
        calls.push(key);
        return [sourceMovie(1, reference.type === 'official' ? 100 : 200)];
      },
    };
    const official = new MdblistProvider({
      apiKey: 'configured',
      client,
      list: { type: 'official', slug: 'official-movies' },
    });
    const publicList = new MdblistProvider({
      apiKey: 'configured',
      client,
      list: { type: 'public', username: 'scott', slug: 'weekend' },
    });

    assert.deepEqual(
      (await official.getStreamingChart({ tmdb: createTmdb() })).map(
        (movie) => movie.id
      ),
      [100]
    );
    assert.deepEqual(
      (await publicList.getStreamingChart({ tmdb: createTmdb() })).map(
        (movie) => movie.id
      ),
      [200]
    );
    await official.getSourceItems();
    await publicList.getSourceItems();

    assert.deepEqual(calls, [
      'official:official-movies',
      'public:scott/weekend',
    ]);
  });

  it('invalidates only the selected normalized list cache', async () => {
    let calls = 0;
    const reference = {
      type: 'public' as const,
      username: 'scott',
      slug: 'weekend',
    };
    const client = {
      getMovieList: async () => {
        calls += 1;
        return [sourceMovie(1, calls * 10)];
      },
    };
    const provider = new MdblistProvider({
      apiKey: 'configured',
      client,
      list: reference,
    });

    assert.deepEqual(
      (await provider.getSourceItems()).map((item) => item.ids.tmdb),
      [10]
    );
    assert.deepEqual(
      (await provider.getSourceItems()).map((item) => item.ids.tmdb),
      [10]
    );
    invalidateMdblistListCache(reference);
    assert.deepEqual(
      (await provider.getSourceItems()).map((item) => item.ids.tmdb),
      [20]
    );
    assert.equal(calls, 2);
  });

  it('keeps known valid TMDb identifiers in source rank order', async () => {
    const provider = new MdblistProvider({
      apiKey: 'configured',
      client: {
        getOfficialMovieList: async () => [
          sourceMovie(7, 1465646, 'tt31150720'),
          sourceMovie(8, 800),
        ],
      },
    });

    const results = await provider.getStreamingChart({ tmdb: createTmdb() });

    assert.deepEqual(
      results.map(({ id, mdblistRank }) => ({ id, mdblistRank })),
      [
        { id: 1465646, mdblistRank: 7 },
        { id: 800, mdblistRank: 8 },
      ]
    );
  });

  it('rejects unsupported source media types at the validation boundary', () => {
    assert.throws(() =>
      MdblistListItemsResponseSchema.parse({
        movies: [
          {
            rank: 1,
            adult: 0,
            ids: { tmdb: 10 },
            mediatype: 'show',
          },
        ],
      })
    );
  });

  it('filters adult flags from either MDBList or hydrated TMDb metadata', async () => {
    const provider = new MdblistProvider({
      apiKey: 'configured',
      client: {
        getOfficialMovieList: async () => [
          { ...sourceMovie(1, 10), adult: 1 },
          sourceMovie(2, 20),
          sourceMovie(3, 30),
        ],
      },
    });
    const tmdb = createTmdb();
    mock.method(tmdb, 'getMovie', async ({ movieId }: { movieId: number }) => ({
      ...movieDetails(movieId),
      adult: movieId === 20,
    }));

    const results = await provider.getStreamingChart({ tmdb });

    assert.deepEqual(
      results.map((movie) => movie.id),
      [30]
    );
  });

  it('returns a native empty page when MDBList is not configured', async () => {
    const page = await new MdblistProvider({
      apiKey: '',
    }).getStreamingChartPage({ tmdb: createTmdb(), page: 1 });

    assert.deepEqual(page, {
      page: 1,
      totalPages: 1,
      totalResults: 0,
      results: [],
    });
  });

  it('serves the last successful chart when a refresh fails', async () => {
    const successfulProvider = new MdblistProvider({
      apiKey: 'configured',
      client: {
        getOfficialMovieList: async () => [sourceMovie(1, 10)],
      },
    });
    await successfulProvider.getSourceItems();
    cacheManager
      .getCache('mdblist')
      .data.del('official:justwatch-streaming-charts:movies');

    const failingProvider = new MdblistProvider({
      apiKey: 'configured',
      client: {
        getOfficialMovieList: async () => {
          throw new Error('timeout');
        },
      },
    });

    assert.deepEqual(await failingProvider.getSourceItems(), [
      sourceMovie(1, 10),
    ]);
  });

  it('handles malformed responses and upstream errors without leaking secrets', async () => {
    const logged: unknown[] = [];
    const secret = 'super-secret-key';
    const provider = new MdblistProvider({
      apiKey: secret,
      client: {
        getOfficialMovieList: async () =>
          MdblistListItemsResponseSchema.parse({ movies: 'invalid' }).movies,
      },
      log: {
        warn: (...args) => logged.push(args),
      },
    });

    assert.deepEqual(await provider.getSourceItems(), []);
    assert.equal(JSON.stringify(logged).includes(secret), false);

    resetMdblistProviderStateForTests();
    const failingProvider = new MdblistProvider({
      apiKey: secret,
      client: {
        getOfficialMovieList: async () => {
          throw new Error(`timeout while using ${secret}`);
        },
      },
      log: {
        warn: (...args) => logged.push(args),
      },
    });

    assert.deepEqual(await failingProvider.getSourceItems(), []);
    assert.equal(JSON.stringify(logged).includes(secret), false);
  });
});
