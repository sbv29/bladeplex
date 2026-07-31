import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import MdblistAPI from '@server/api/mdblist';
import type { MdblistListReference } from '@server/api/mdblist/interfaces';
import type TheMovieDb from '@server/api/themoviedb';
import { getRepository } from '@server/datasource';
import CustomList from '@server/entity/CustomList';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import { resetMdblistProviderStateForTests } from '@server/lib/mdblist';
import {
  MdblistCollectionError,
  MdblistCollectionService,
} from '@server/lib/mdblistCollections';
import { setupTestDb } from '@server/test/db';

setupTestDb();

const movieDetails = (id: number, poster = `/poster-${id}.jpg`) =>
  ({
    id,
    adult: false,
    genres: [{ id: id === 10 ? 28 : 35, name: 'Genre' }],
    original_language: 'en',
    original_title: `Movie ${id}`,
    overview: '',
    popularity: id,
    release_date: '2026-01-01',
    title: `Movie ${id}`,
    video: false,
    vote_average: 7,
    vote_count: 10,
    backdrop_path: null,
    poster_path: poster,
  }) as unknown as Awaited<ReturnType<TheMovieDb['getMovie']>>;

const sourceItems = (ids = [10, 20, 30]) =>
  ids.map((id, index) => ({
    rank: index + 1,
    adult: 0,
    title: `Movie ${id}`,
    release_year: 2026,
    ids: { tmdb: id },
    mediatype: 'movie' as const,
  }));

const tvDetails = (id: number) =>
  ({
    id,
    adult: false,
    backdrop_path: null,
    first_air_date: '2026-01-01',
    genres: [{ id: 18, name: 'Drama' }],
    name: `Show ${id}`,
    origin_country: ['US'],
    original_language: 'en',
    original_name: `Show ${id}`,
    overview: '',
    popularity: id,
    poster_path: `/show-${id}.jpg`,
    vote_average: 8,
    vote_count: 20,
  }) as unknown as Awaited<ReturnType<TheMovieDb['getTvShow']>>;

const createDependencies = () => {
  const client = new MdblistAPI('configured');
  mock.method(
    client,
    'getListMetadata',
    async (reference: MdblistListReference) => ({
      id: reference.slug === 'other' ? 12 : 11,
      name: reference.slug === 'other' ? 'Other Movies' : 'Weekend Movies',
      slug: reference.slug,
      private: false,
      mediatype: 'movie',
      user_name: reference.type === 'public' ? reference.username : 'official',
      items: 3,
    })
  );
  mock.method(client, 'getMovieList', async () => sourceItems());
  const tmdb = {
    getMovie: async ({ movieId }: { movieId: number }) => movieDetails(movieId),
  } as unknown as TheMovieDb;
  return { client, tmdb };
};

beforeEach(async () => {
  resetMdblistProviderStateForTests();
  await getRepository(DiscoverSlider).clear();
  await getRepository(CustomList).clear();
});

afterEach(() => {
  mock.restoreAll();
});

describe('MdblistCollectionService', () => {
  it('validates and normalizes a public movie collection', async () => {
    const service = new MdblistCollectionService({
      apiKey: 'configured',
      ...createDependencies(),
    });
    const result = await service.validate(
      'https://www.mdblist.com/lists/Owner/Weekend-Movies?ignored=true'
    );

    assert.equal(
      result.canonicalUrl,
      'https://mdblist.com/lists/owner/weekend-movies'
    );
    assert.equal(result.owner, 'owner');
    assert.equal(result.slug, 'weekend-movies');
    assert.equal(result.mediaType, 'movie');
    assert.equal(result.usableItemCount, 3);
    assert.deepEqual(
      result.movies.map(({ id, mdblistRank }) => ({ id, mdblistRank })),
      [
        { id: 10, mdblistRank: 1 },
        { id: 20, mdblistRank: 2 },
        { id: 30, mdblistRank: 3 },
      ]
    );
    assert.equal(result.preview.length, 3);
  });

  it('rejects missing keys, private lists, and unsupported lists safely', async () => {
    const dependencies = createDependencies();
    await assert.rejects(
      new MdblistCollectionService({ apiKey: '', ...dependencies }).validate(
        'https://mdblist.com/lists/owner/movies'
      ),
      (error: unknown) =>
        error instanceof MdblistCollectionError &&
        error.code === 'missing_api_key'
    );

    mock.restoreAll();
    const privateClient = new MdblistAPI('configured');
    mock.method(privateClient, 'getListMetadata', async () => ({
      id: 1,
      name: 'Private',
      private: true,
      mediatype: 'movie',
      items: 1,
    }));
    await assert.rejects(
      new MdblistCollectionService({
        apiKey: 'configured',
        client: privateClient,
        tmdb: dependencies.tmdb,
      }).validate('https://mdblist.com/lists/owner/private'),
      /Private MDBList lists are not supported/
    );

    mock.restoreAll();
    const showClient = new MdblistAPI('configured');
    mock.method(showClient, 'getListMetadata', async () => ({
      id: 2,
      name: 'Shows',
      private: false,
      mediatype: 'music',
      items: 1,
    }));
    await assert.rejects(
      new MdblistCollectionService({
        apiKey: 'configured',
        client: showClient,
        tmdb: dependencies.tmdb,
      }).validate('https://mdblist.com/lists/owner/shows'),
      /Only MDBList movie and TV lists/
    );
  });

  it('creates, updates, toggles, reorders, and deletes collections', async () => {
    const service = new MdblistCollectionService({
      apiKey: 'configured',
      ...createDependencies(),
    });
    const first = await service.create({
      url: 'https://mdblist.com/lists/owner/weekend',
      title: 'Friday Night',
    });
    const second = await service.create({
      url: 'https://mdblist.com/lists/owner/other',
    });

    assert.equal(first.title, 'Friday Night');
    assert.equal(first.mdblistId, 11);
    assert.ok(first.selectedArtworkTmdbId);
    assert.ok(first.selectedArtworkPosterPath);
    assert.equal(first.artworkOverlayColor, '#4f46e5');
    assert.ok(first.lastValidatedAt);
    assert.equal(first.enabled, true);
    assert.equal(second.sortOrder, first.sortOrder + 1);

    await assert.rejects(
      service.create({ url: 'https://mdblist.com/lists/owner/weekend' }),
      (error: unknown) =>
        error instanceof MdblistCollectionError && error.code === 'duplicate'
    );

    assert.equal(
      (await service.update(first.id, { title: 'Updated' })).title,
      'Updated'
    );
    assert.equal(
      (
        await service.update(first.id, {
          artworkOverlayColor: '#dc2626',
        })
      ).artworkOverlayColor,
      '#dc2626'
    );
    await assert.rejects(
      service.update(first.id, { artworkOverlayColor: 'red' }),
      /Invalid artwork overlay color/
    );
    assert.equal((await service.setEnabled(first.id, false)).enabled, false);
    assert.deepEqual(
      (await service.reorder([second.id, first.id])).map((list) => list.id),
      [second.id, first.id]
    );

    await service.delete(first.id);
    assert.equal(await getRepository(CustomList).countBy({ id: first.id }), 0);
  });

  it('reuses normalized cache and shuffles to different artwork when possible', async () => {
    const dependencies = createDependencies();
    let sourceCalls = 0;
    mock.restoreAll();
    mock.method(dependencies.client, 'getListMetadata', async () => ({
      id: 11,
      name: 'Weekend Movies',
      private: false,
      mediatype: 'movie',
      user_name: 'owner',
      items: 3,
    }));
    mock.method(dependencies.client, 'getMovieList', async () => {
      sourceCalls += 1;
      return sourceItems();
    });
    const service = new MdblistCollectionService({
      apiKey: 'configured',
      ...dependencies,
    });
    const collection = await service.create({
      url: 'https://mdblist.com/lists/owner/weekend',
    });
    const originalArtwork = collection.selectedArtworkTmdbId;
    const shuffled = await service.shuffleArtwork(collection.id);

    assert.equal(sourceCalls, 1);
    assert.notEqual(shuffled.selectedArtworkTmdbId, originalArtwork);
  });

  it('uses a native no-artwork fallback when no hydrated poster is available', async () => {
    const dependencies = createDependencies();
    mock.method(
      dependencies.tmdb,
      'getMovie',
      async ({ movieId }: { movieId: number }) => movieDetails(movieId, '')
    );
    const service = new MdblistCollectionService({
      apiKey: 'configured',
      ...dependencies,
    });
    const collection = await service.create({
      url: 'https://mdblist.com/lists/owner/weekend',
    });

    assert.equal(collection.selectedArtworkTmdbId, null);
    assert.equal(collection.selectedArtworkPosterPath, null);
  });

  it('creates and orders TV collections independently from movies', async () => {
    const client = new MdblistAPI('configured');
    mock.method(client, 'getListMetadata', async () => ({
      id: 55,
      name: 'Great Series',
      private: false,
      mediatype: 'show',
      items: 2,
    }));
    mock.method(client, 'getShowList', async () =>
      [101, 202].map((id, index) => ({
        rank: index + 1,
        adult: 0,
        title: `Show ${id}`,
        release_year: 2026,
        ids: { tmdb: id },
        mediatype: 'show' as const,
      }))
    );
    const tmdb = {
      getTvShow: async ({ tvId }: { tvId: number }) => tvDetails(tvId),
    } as unknown as TheMovieDb;
    const service = new MdblistCollectionService({
      apiKey: 'configured',
      client,
      tmdb,
    });
    const collection = await service.create({
      url: 'https://mdblist.com/lists/official/shows/great-series',
    });

    assert.equal(collection.mediaType, 'tv');
    assert.equal(collection.title, 'Great Series');
    assert.ok(collection.selectedArtworkPosterPath);
    assert.deepEqual(
      (await service.reorder([collection.id], 'tv')).map((item) => item.id),
      [collection.id]
    );
  });

  it('filters before pagination and keeps seeded shuffle stable', async () => {
    const service = new MdblistCollectionService({
      apiKey: 'configured',
      ...createDependencies(),
    });
    const collection = await service.create({
      url: 'https://mdblist.com/lists/owner/weekend',
    });
    const filtered = await service.getCollectionPage({
      id: collection.id,
      query: { genre: 28, voteAverageGte: 6, sortBy: 'rank' },
    });
    const first = await service.getCollectionPage({
      id: collection.id,
      query: { sortBy: 'random', seed: 'shared-seed' },
    });
    const second = await service.getCollectionPage({
      id: collection.id,
      query: { sortBy: 'random', seed: 'shared-seed' },
    });

    assert.equal(filtered.totalResults, 1);
    assert.deepEqual(
      filtered.results.map((movie) => movie.id),
      [10]
    );
    assert.deepEqual(
      first.results.map((movie) => movie.id),
      second.results.map((movie) => movie.id)
    );
  });
});
