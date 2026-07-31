import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AddCustomLists1785370000000 } from '@server/migration/sqlite/1785370000000-AddCustomLists';
import { AddTvCustomLists1785450000000 } from '@server/migration/sqlite/1785450000000-AddTvCustomLists';
import { AddMdblistCollectionFields1785540000000 } from '@server/migration/sqlite/1785540000000-AddMdblistCollectionFields';
import { AddCollectionOverlayColor1785541000000 } from '@server/migration/sqlite/1785541000000-AddCollectionOverlayColor';
import { AddTvCollectionsSlider1785542000000 } from '@server/migration/sqlite/1785542000000-AddTvCollectionsSlider';
import { SeparateCollectionsFromCustomLists1785543000000 } from '@server/migration/sqlite/1785543000000-SeparateCollectionsFromCustomLists';
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

  it('adds collection fields and migrates movie slider state only', async () => {
    const dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    const initial = new AddCustomLists1785370000000();
    const tv = new AddTvCustomLists1785450000000();
    const collections = new AddMdblistCollectionFields1785540000000();

    try {
      await initial.up(queryRunner);
      await tv.up(queryRunner);
      await queryRunner.query(
        `CREATE TABLE "discover_slider" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" integer NOT NULL, "order" integer NOT NULL, "isBuiltIn" boolean NOT NULL DEFAULT (0), "enabled" boolean NOT NULL DEFAULT (1), "title" varchar, "data" varchar)`
      );
      await queryRunner.query(
        `INSERT INTO "custom_list" ("provider", "listType", "title", "sourceUrl", "username", "slug", "mediaType") VALUES
          ('mdblist', 'public', 'Second Movie', 'https://mdblist.com/lists/test/second', 'test', 'second', 'movie'),
          ('mdblist', 'public', 'First Movie', 'https://mdblist.com/lists/test/first', 'test', 'first', 'movie'),
          ('mdblist', 'public', 'Unlinked Movie', 'https://mdblist.com/lists/test/unlinked', 'test', 'unlinked', 'movie'),
          ('mdblist', 'public', 'TV List', 'https://mdblist.com/lists/test/tv', 'test', 'tv', 'tv')`
      );
      await queryRunner.query(
        `INSERT INTO "discover_slider" ("type", "order", "enabled", "data") VALUES
          (25, 12, 0, '1'),
          (25, 4, 1, '2'),
          (26, 2, 0, '4')`
      );

      await collections.up(queryRunner);

      assert.deepEqual(
        await queryRunner.query(
          `SELECT "id", "mediaType", "enabled", "sortOrder" FROM "custom_list" ORDER BY "id"`
        ),
        [
          { id: 1, mediaType: 'movie', enabled: 0, sortOrder: 12 },
          { id: 2, mediaType: 'movie', enabled: 1, sortOrder: 4 },
          { id: 3, mediaType: 'movie', enabled: 1, sortOrder: 1000003 },
          { id: 4, mediaType: 'tv', enabled: 1, sortOrder: 0 },
        ]
      );
      assert.equal(
        (
          await queryRunner.query(
            `SELECT COUNT(*) AS "count" FROM "discover_slider"`
          )
        )[0].count,
        4
      );
      assert.deepEqual(
        await queryRunner.query(
          `SELECT "type", "order", "enabled" FROM "discover_slider" WHERE "type" = 27`
        ),
        [{ type: 27, order: 13, enabled: 1 }]
      );

      const table = await queryRunner.getTable('custom_list');
      assert.ok(
        table?.indices.some(
          (index) => index.name === 'IDX_custom_list_collection_order'
        )
      );
      assert.ok(
        table?.indices.some(
          (index) => index.name === 'IDX_custom_list_mdblist_id'
        )
      );

      await collections.down(queryRunner);
      const reverted = await queryRunner.getTable('custom_list');
      assert.equal(reverted?.findColumnByName('enabled'), undefined);
      assert.equal(reverted?.findColumnByName('sortOrder'), undefined);
    } finally {
      await queryRunner.release();
      await dataSource.destroy();
    }
  });

  it('adds a default overlay color to movie collections only', async () => {
    const dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    const initial = new AddCustomLists1785370000000();
    const tv = new AddTvCustomLists1785450000000();
    const collections = new AddMdblistCollectionFields1785540000000();
    const overlay = new AddCollectionOverlayColor1785541000000();
    const tvCollections = new AddTvCollectionsSlider1785542000000();
    const separation = new SeparateCollectionsFromCustomLists1785543000000();

    try {
      await initial.up(queryRunner);
      await tv.up(queryRunner);
      await queryRunner.query(
        `CREATE TABLE "discover_slider" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" integer NOT NULL, "order" integer NOT NULL, "isBuiltIn" boolean NOT NULL DEFAULT (0), "enabled" boolean NOT NULL DEFAULT (1), "title" varchar, "data" varchar)`
      );
      await queryRunner.query(
        `INSERT INTO "custom_list" ("provider", "listType", "title", "sourceUrl", "username", "slug", "mediaType") VALUES
          ('mdblist', 'public', 'Movies', 'https://mdblist.com/lists/test/movies', 'test', 'movies', 'movie'),
          ('mdblist', 'public', 'TV', 'https://mdblist.com/lists/test/tv', 'test', 'tv', 'tv')`
      );
      await collections.up(queryRunner);
      await overlay.up(queryRunner);
      await queryRunner.query(
        `INSERT INTO "discover_slider" ("type", "order", "enabled", "data") VALUES (26, 7, 0, '2')`
      );
      await tvCollections.up(queryRunner);

      assert.deepEqual(
        await queryRunner.query(
          `SELECT "mediaType", "artworkOverlayColor" FROM "custom_list" ORDER BY "id"`
        ),
        [
          { mediaType: 'movie', artworkOverlayColor: '#4f46e5' },
          { mediaType: 'tv', artworkOverlayColor: null },
        ]
      );
      assert.deepEqual(
        await queryRunner.query(
          `SELECT "enabled", "sortOrder" FROM "custom_list" WHERE "mediaType" = 'tv'`
        ),
        [{ enabled: 0, sortOrder: 7 }]
      );
      assert.deepEqual(
        await queryRunner.query(
          `SELECT "type", "order" FROM "discover_slider" WHERE "type" = 28`
        ),
        [{ type: 28, order: 8 }]
      );
      await separation.up(queryRunner);
      assert.deepEqual(
        await queryRunner.query(
          `SELECT "mediaType", "isCollection", COUNT(*) AS "count" FROM "custom_list" GROUP BY "mediaType", "isCollection" ORDER BY "mediaType", "isCollection"`
        ),
        [
          { mediaType: 'movie', isCollection: 0, count: 1 },
          { mediaType: 'movie', isCollection: 1, count: 1 },
          { mediaType: 'tv', isCollection: 0, count: 1 },
          { mediaType: 'tv', isCollection: 1, count: 1 },
        ]
      );

      await separation.down(queryRunner);
      await tvCollections.down(queryRunner);
      await overlay.down(queryRunner);
      assert.equal(
        (await queryRunner.getTable('custom_list'))?.findColumnByName(
          'artworkOverlayColor'
        ),
        undefined
      );
    } finally {
      await queryRunner.release();
      await dataSource.destroy();
    }
  });
});
