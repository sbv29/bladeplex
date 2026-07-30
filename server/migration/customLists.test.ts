import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AddCustomLists1785370000000 } from '@server/migration/sqlite/1785370000000-AddCustomLists';
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
});
