import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AddCustomLists1785370000000 } from '@server/migration/sqlite/1785370000000-AddCustomLists';
import { AddTvCustomLists1785450000000 } from '@server/migration/sqlite/1785450000000-AddTvCustomLists';
import { DataSource } from 'typeorm';

describe('custom list migration', () => {
  it('applies and reverts the SQLite migration', async () => {
    const dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
    });
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    const migration = new AddCustomLists1785370000000();

    try {
      await migration.up(queryRunner);
      assert.equal(await queryRunner.hasTable('custom_list'), true);

      const table = await queryRunner.getTable('custom_list');
      assert.ok(
        table?.indices.some(
          (index) => index.name === 'UQ_custom_list_source' && index.isUnique
        )
      );

      await migration.down(queryRunner);
      assert.equal(await queryRunner.hasTable('custom_list'), false);
    } finally {
      await queryRunner.release();
      await dataSource.destroy();
    }
  });

  it('adds TV list support while preserving movie lists', async () => {
    const dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    const initial = new AddCustomLists1785370000000();
    const tv = new AddTvCustomLists1785450000000();

    try {
      await initial.up(queryRunner);
      await queryRunner.query(
        `INSERT INTO "custom_list" ("provider", "listType", "title", "sourceUrl", "username", "slug", "mediaType") VALUES ('mdblist', 'public', 'Movies', 'https://mdblist.com/lists/test/movies', 'test', 'movies', 'movie')`
      );
      await tv.up(queryRunner);
      await queryRunner.query(
        `INSERT INTO "custom_list" ("provider", "listType", "title", "sourceUrl", "username", "slug", "mediaType") VALUES ('mdblist', 'official', 'Shows', 'https://mdblist.com/lists/official/shows/moviemeter', '', 'moviemeter', 'tv')`
      );
      assert.deepEqual(
        await queryRunner.query(
          `SELECT "mediaType" FROM "custom_list" ORDER BY "id"`
        ),
        [{ mediaType: 'movie' }, { mediaType: 'tv' }]
      );

      await tv.down(queryRunner);
      assert.deepEqual(
        await queryRunner.query(`SELECT "mediaType" FROM "custom_list"`),
        [{ mediaType: 'movie' }]
      );
    } finally {
      await queryRunner.release();
      await dataSource.destroy();
    }
  });
});
