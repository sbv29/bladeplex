import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import ImdbApi from '@server/api/rating/imdb';
import IMDBRadarrProxy from '@server/api/rating/imdbRadarrProxy';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { ImdbRatingCache } from '@server/entity/ImdbRatingCache';
import imdbRatingCache from '@server/lib/imdbRatingCache';
import { AddImdbRatingCache1785270000000 } from '@server/migration/sqlite/1785270000000-AddImdbRatingCache';
import { AddMediaTypeToImdbRatingCache1785400000000 } from '@server/migration/sqlite/1785400000000-AddMediaTypeToImdbRatingCache';
import { setupTestDb } from '@server/test/db';
import { DataSource } from 'typeorm';

setupTestDb();

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
    const getMovieRatings = mock.method(
      IMDBRadarrProxy.prototype,
      'getMovieRatings',
      async () => ({
        title: 'Fight Club',
        url: 'https://www.imdb.com/title/tt0137523',
        criticsScore: 8.8,
        criticsScoreCount: 2_631_028,
      })
    );

    try {
      const imdbIds = new Map([[550, 'tt0137523']]);
      const first = await imdbRatingCache.getRatings([550], imdbIds);
      const second = await imdbRatingCache.getRatings([550], imdbIds);

      assert.strictEqual(first['550']?.criticsScore, 8.8);
      assert.deepStrictEqual(second, first);
      assert.strictEqual(getMovieRatings.mock.callCount(), 1);
      assert.strictEqual(await getRepository(ImdbRatingCache).count(), 1);
    } finally {
      getMovieRatings.mock.restore();
    }
  });

  it('uses show-level IMDb ratings for TV series', async () => {
    const getTitleRating = mock.method(
      ImdbApi.prototype,
      'getTitleRating',
      async () => ({
        title: 'Breaking Bad',
        url: 'https://www.imdb.com/title/tt0903747',
        criticsScore: 9.5,
        criticsScoreCount: 2_649_218,
      })
    );

    try {
      const ratings = await imdbRatingCache.getRatings(
        [1396],
        new Map([[1396, 'tt0903747']]),
        MediaType.TV
      );

      assert.strictEqual(ratings['1396']?.criticsScore, 9.5);
      assert.strictEqual(getTitleRating.mock.callCount(), 1);
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
      getTitleRating.mock.restore();
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
    const getMovieRatings = mock.method(
      IMDBRadarrProxy.prototype,
      'getMovieRatings',
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
    } finally {
      getMovieRatings.mock.restore();
    }
  });
});
