import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTvCollectionsSlider1785542000000 implements MigrationInterface {
  name = 'AddTvCollectionsSlider1785542000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "custom_list"
       SET "enabled" = COALESCE(
             (SELECT "enabled" FROM "discover_slider"
              WHERE "type" = 26 AND "data" = CAST("custom_list"."id" AS varchar)
              ORDER BY "id" ASC LIMIT 1), true),
           "sortOrder" = COALESCE(
             (SELECT "order" FROM "discover_slider"
              WHERE "type" = 26 AND "data" = CAST("custom_list"."id" AS varchar)
              ORDER BY "id" ASC LIMIT 1), 1000000 + "id")
       WHERE "mediaType" = 'tv' AND "provider" = 'mdblist'`
    );
    await queryRunner.query(
      `INSERT INTO "discover_slider" ("type", "order", "isBuiltIn", "enabled")
       SELECT 28, COALESCE(MAX("order"), -1) + 1, true, true FROM "discover_slider"
       WHERE NOT EXISTS (SELECT 1 FROM "discover_slider" WHERE "type" = 28)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "discover_slider" WHERE "type" = 28`);
  }
}
