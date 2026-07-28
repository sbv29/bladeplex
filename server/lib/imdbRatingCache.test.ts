import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import IMDBRadarrProxy from '@server/api/rating/imdbRadarrProxy';
import { getRepository } from '@server/datasource';
import { ImdbRatingCache } from '@server/entity/ImdbRatingCache';
import imdbRatingCache from '@server/lib/imdbRatingCache';
import { AddImdbRatingCache1785270000000 } from '@server/migration/sqlite/1785270000000-AddImdbRatingCache';
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
      assert.strictEqual(await queryRunner.hasTable('imdb_rating_cache'), false);
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
