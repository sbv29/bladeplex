import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

import MdblistRatingsAPI from '@server/api/mdblist/ratings';
import { MediaType } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import { ImdbRatingCache } from '@server/entity/ImdbRatingCache';
import Media from '@server/entity/Media';
import imdbRatingCache from '@server/lib/imdbRatingCache';
import { getSettings } from '@server/lib/settings';
import { AddImdbRatingCache1785270000000 } from '@server/migration/sqlite/1785270000000-AddImdbRatingCache';
import { AddMediaTypeToImdbRatingCache1785400000000 } from '@server/migration/sqlite/1785400000000-AddMediaTypeToImdbRatingCache';
import { AddImdbRatingProviderState1785544000000 } from '@server/migration/sqlite/1785544000000-AddImdbRatingProviderState';
import { setupTestDb } from '@server/test/db';
import { DataSource } from 'typeorm';

setupTestDb();

beforeEach(() => {
  getSettings().main.mdblistApiKey = 'test-key';
});

describe('IMDb rating cache', () => {
  it('applies and reverts the SQLite migration', async () => {
    const dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
    });
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    const migration = new AddImdbRatingCache1785270000000();

    try {
      await migration.up(queryRunner);
      assert.strictEqual(await queryRunner.hasTable('imdb_rating_cache'), true);
      await migration.down(queryRunner);
      assert.strictEqual(
        await queryRunner.hasTable('imdb_rating_cache'),
        false
      );
    } finally {
      await queryRunner.release();
      await dataSource.destroy();
    }
  });

  it('migrates the SQLite cache to media-specific keys', async () => {
    const dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
    });
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    const initialMigration = new AddImdbRatingCache1785270000000();
    const mediaTypeMigration = new AddMediaTypeToImdbRatingCache1785400000000();

    try {
      await initialMigration.up(queryRunner);
      await mediaTypeMigration.up(queryRunner);
      const table = await queryRunner.getTable('imdb_rating_cache');

      assert.ok(table?.findColumnByName('mediaType'));
      assert.ok(
        table?.uniques.some(
          (unique) =>
            unique.columnNames.includes('tmdbId') &&
            unique.columnNames.includes('mediaType')
        )
      );

      await mediaTypeMigration.down(queryRunner);
      assert.equal(
        (await queryRunner.getTable('imdb_rating_cache'))?.findColumnByName(
          'mediaType'
        ),
        undefined
      );
    } finally {
      await queryRunner.release();
      await dataSource.destroy();
    }
  });

  it('persists a cold rating and reuses it on the next request', async () => {
    const getImdbRatings = mock.method(
      MdblistRatingsAPI.prototype,
      'getImdbRatings',
      async () => ({
        ratings: [
          {
            tmdbId: 550,
            imdbId: 'tt0137523',
            title: 'Fight Club',
            rating: 8.8,
            votes: 2_631_028,
          },
        ],
        returnedTmdbIds: new Set([550]),
        quota: { limit: 1000, remaining: 900 },
      })
    );

    try {
      const imdbIds = new Map([[550, 'tt0137523']]);
      const first = await imdbRatingCache.getRatings([550], imdbIds);
      assert.strictEqual(first['550'], null);
      await imdbRatingCache.processPending();
      const second = await imdbRatingCache.getRatings([550], imdbIds);

      assert.strictEqual(second['550']?.criticsScore, 8.8);
      assert.strictEqual(getImdbRatings.mock.callCount(), 1);
      assert.strictEqual(await getRepository(ImdbRatingCache).count(), 1);
      const record = await getRepository(ImdbRatingCache).findOneByOrFail({
        tmdbId: 550,
      });
      assert.strictEqual(record.source, 'mdblist-imdb');
      assert.ok(record.nextRetryAt);
    } finally {
      getImdbRatings.mock.restore();
    }
  });

  it('uses show-level IMDb ratings for TV series', async () => {
    const getImdbRatings = mock.method(
      MdblistRatingsAPI.prototype,
      'getImdbRatings',
      async () => ({
        ratings: [
          {
            tmdbId: 1396,
            imdbId: 'tt0903747',
            title: 'Breaking Bad',
            rating: 9.5,
            votes: 2_649_218,
          },
        ],
        returnedTmdbIds: new Set([1396]),
        quota: {},
      })
    );

    try {
      const ratings = await imdbRatingCache.getRatings(
        [1396],
        new Map([[1396, 'tt0903747']]),
        MediaType.TV
      );
      assert.strictEqual(ratings['1396'], null);
      await imdbRatingCache.processPending();
      const persisted = await imdbRatingCache.getRatings(
        [1396],
        new Map(),
        MediaType.TV
      );

      assert.strictEqual(persisted['1396']?.criticsScore, 9.5);
      assert.strictEqual(getImdbRatings.mock.callCount(), 1);
      assert.strictEqual(
        (
          await getRepository(ImdbRatingCache).findOneByOrFail({
            tmdbId: 1396,
            mediaType: MediaType.TV,
          })
        ).imdbId,
        'tt0903747'
      );
    } finally {
      getImdbRatings.mock.restore();
    }
  });

  it('warms unresolved ratings after a media library scan', async () => {
    await getRepository(Media).save([
      {
        tmdbId: 550,
        mediaType: MediaType.MOVIE,
        imdbId: 'tt0137523',
        ratingKey: 'plex-movie',
      },
      {
        tmdbId: 1396,
        mediaType: MediaType.TV,
        imdbId: 'tt0903747',
        ratingKey: 'plex-show',
      },
      {
        tmdbId: 155,
        mediaType: MediaType.MOVIE,
        imdbId: 'tt0468569',
      },
    ]);
    const getImdbRatings = mock.method(
      MdblistRatingsAPI.prototype,
      'getImdbRatings',
      async (
        _mediaType: MediaType.MOVIE | MediaType.TV,
        tmdbIds: number[]
      ) => ({
        ratings: tmdbIds.map((tmdbId) => ({
          tmdbId,
          rating: tmdbId === 550 ? 8.8 : 9.5,
          votes: 100,
        })),
        returnedTmdbIds: new Set(tmdbIds),
        quota: {},
      })
    );

    try {
      await imdbRatingCache.warmLibrary(MediaServerType.PLEX);
      await imdbRatingCache.processPending();

      const records = await getRepository(ImdbRatingCache).find({
        order: { tmdbId: 'ASC' },
      });
      assert.deepStrictEqual(
        records.map(({ tmdbId, mediaType, ratingTenths }) => ({
          tmdbId,
          mediaType,
          ratingTenths,
        })),
        [
          { tmdbId: 550, mediaType: MediaType.MOVIE, ratingTenths: 88 },
          { tmdbId: 1396, mediaType: MediaType.TV, ratingTenths: 95 },
        ]
      );
      assert.strictEqual(getImdbRatings.mock.callCount(), 2);
    } finally {
      getImdbRatings.mock.restore();
    }
  });

  it('keeps movie and TV ratings separate when TMDB IDs overlap', async () => {
    await getRepository(ImdbRatingCache).save([
      {
        tmdbId: 100,
        mediaType: MediaType.MOVIE,
        imdbId: 'tt-movie',
        ratingTenths: 71,
        voteCount: 10,
        missing: false,
        failureCount: 0,
      },
      {
        tmdbId: 100,
        mediaType: MediaType.TV,
        imdbId: 'tt-tv',
        ratingTenths: 89,
        voteCount: 20,
        missing: false,
        failureCount: 0,
      },
    ]);

    const movieRatings = await imdbRatingCache.getRatings(
      [100],
      new Map(),
      MediaType.MOVIE
    );
    const tvRatings = await imdbRatingCache.getRatings(
      [100],
      new Map(),
      MediaType.TV
    );

    assert.strictEqual(movieRatings['100']?.criticsScore, 7.1);
    assert.strictEqual(tvRatings['100']?.criticsScore, 8.9);
  });

  it('returns a persisted rating without an external request', async () => {
    await getRepository(ImdbRatingCache).save({
      tmdbId: 550,
      imdbId: 'tt0137523',
      title: 'Fight Club',
      ratingTenths: 88,
      voteCount: 2_631_028,
      url: 'https://www.imdb.com/title/tt0137523',
      missing: false,
      failureCount: 0,
      lastAttemptAt: new Date(),
      lastSuccessAt: new Date(),
    });

    const ratings = await imdbRatingCache.getRatings([550]);

    assert.deepStrictEqual(ratings['550'], {
      title: 'Fight Club',
      url: 'https://www.imdb.com/title/tt0137523',
      criticsScore: 8.8,
      criticsScoreCount: 2_631_028,
    });
  });

  it('reports and clears the persistent record count', async () => {
    await getRepository(ImdbRatingCache).save({
      tmdbId: 550,
      imdbId: 'tt0137523',
      ratingTenths: 88,
      voteCount: 2_631_028,
      missing: false,
      failureCount: 0,
    });

    assert.strictEqual(await imdbRatingCache.count(), 1);
    await imdbRatingCache.clear();
    assert.strictEqual(await imdbRatingCache.count(), 0);
  });

  it('returns null for a persisted missing rating', async () => {
    await getRepository(ImdbRatingCache).save({
      tmdbId: 980431,
      imdbId: 'tt18259538',
      missing: true,
      failureCount: 0,
      lastAttemptAt: new Date(),
    });

    const ratings = await imdbRatingCache.getRatings([980431]);

    assert.strictEqual(ratings['980431'], null);
  });

  it('preserves the last-known rating when a refresh fails', async () => {
    await getRepository(ImdbRatingCache).save({
      tmdbId: 550,
      imdbId: 'tt0137523',
      title: 'Fight Club',
      ratingTenths: 88,
      voteCount: 2_631_028,
      missing: false,
      failureCount: 0,
    });
    const getImdbRatings = mock.method(
      MdblistRatingsAPI.prototype,
      'getImdbRatings',
      async () => {
        throw new Error('provider unavailable');
      }
    );

    try {
      await imdbRatingCache.refreshAll();
      const record = await getRepository(ImdbRatingCache).findOneByOrFail({
        tmdbId: 550,
      });

      assert.strictEqual(record.ratingTenths, 88);
      assert.strictEqual(record.voteCount, 2_631_028);
      assert.strictEqual(record.failureCount, 1);
      assert.ok(record.nextRetryAt);
    } finally {
      getImdbRatings.mock.restore();
    }
  });

  it('processes partial batches without overwriting successful cache values', async () => {
    await getRepository(ImdbRatingCache).save([
      {
        tmdbId: 550,
        mediaType: MediaType.MOVIE,
        imdbId: 'tt0137523',
        ratingTenths: 88,
        voteCount: 100,
        missing: false,
        failureCount: 0,
      },
      {
        tmdbId: 155,
        mediaType: MediaType.MOVIE,
        imdbId: 'tt0468569',
        ratingTenths: 90,
        voteCount: 200,
        missing: false,
        failureCount: 0,
      },
    ]);
    const getImdbRatings = mock.method(
      MdblistRatingsAPI.prototype,
      'getImdbRatings',
      async () => ({
        ratings: [
          {
            tmdbId: 550,
            imdbId: 'tt0137523',
            rating: 8.9,
            votes: 300,
          },
        ],
        returnedTmdbIds: new Set([550]),
        quota: {},
      })
    );

    try {
      await imdbRatingCache.refreshAll();
      const records = await getRepository(ImdbRatingCache).find({
        order: { tmdbId: 'ASC' },
      });
      assert.strictEqual(
        records.find((item) => item.tmdbId === 550)?.ratingTenths,
        89
      );
      assert.strictEqual(
        records.find((item) => item.tmdbId === 155)?.ratingTenths,
        90
      );
      assert.strictEqual(
        records.find((item) => item.tmdbId === 155)?.voteCount,
        200
      );
    } finally {
      getImdbRatings.mock.restore();
    }
  });

  it('adds and removes provider state fields in SQLite', async () => {
    const dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    try {
      await new AddImdbRatingCache1785270000000().up(queryRunner);
      await new AddMediaTypeToImdbRatingCache1785400000000().up(queryRunner);
      const migration = new AddImdbRatingProviderState1785544000000();
      await migration.up(queryRunner);
      const table = await queryRunner.getTable('imdb_rating_cache');
      assert.ok(table?.findColumnByName('source'));
      assert.ok(table?.findColumnByName('nextRetryAt'));
      await migration.down(queryRunner);
      assert.equal(
        (await queryRunner.getTable('imdb_rating_cache'))?.findColumnByName(
          'nextRetryAt'
        ),
        undefined
      );
    } finally {
      await queryRunner.release();
      await dataSource.destroy();
    }
  });
});
