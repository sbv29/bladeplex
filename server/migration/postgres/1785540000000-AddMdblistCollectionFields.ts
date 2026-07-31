import type { MigrationInterface, QueryRunner } from 'typeorm';

const MDBLIST_CUSTOM_MOVIES_SLIDER_TYPE = 25;

export class AddMdblistCollectionFields1785540000000 implements MigrationInterface {
  name = 'AddMdblistCollectionFields1785540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_list" ADD "enabled" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" ADD "sortOrder" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" ADD "mdblistId" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" ADD "selectedArtworkTmdbId" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" ADD "selectedArtworkPosterPath" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" ADD "lastValidatedAt" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(`ALTER TABLE "custom_list" ADD "metadata" text`);

    await queryRunner.query(
      `UPDATE "custom_list" AS list
       SET "enabled" = COALESCE(slider."enabled", true),
           "sortOrder" = COALESCE(slider."order", 1000000 + list."id")
       FROM (SELECT DISTINCT ON ("data") "data", "enabled", "order"
             FROM "discover_slider"
             WHERE "type" = ${MDBLIST_CUSTOM_MOVIES_SLIDER_TYPE}
             ORDER BY "data", "id" ASC) AS slider
       WHERE list."mediaType" = 'movie'
         AND slider."data" = CAST(list."id" AS character varying)`
    );
    await queryRunner.query(
      `UPDATE "custom_list"
       SET "sortOrder" = 1000000 + "id"
       WHERE "mediaType" = 'movie'
         AND NOT EXISTS (
           SELECT 1 FROM "discover_slider"
           WHERE "type" = ${MDBLIST_CUSTOM_MOVIES_SLIDER_TYPE}
             AND "data" = CAST("custom_list"."id" AS character varying)
         )`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_custom_list_collection_order" ON "custom_list" ("mediaType", "enabled", "sortOrder")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_custom_list_mdblist_id" ON "custom_list" ("mdblistId")`
    );
    await queryRunner.query(
      `INSERT INTO "discover_slider" ("type", "order", "isBuiltIn", "enabled")
       SELECT 27, COALESCE(MAX("order"), -1) + 1, true, true FROM "discover_slider"
       WHERE NOT EXISTS (SELECT 1 FROM "discover_slider" WHERE "type" = 27)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "discover_slider" WHERE "type" = 27`);
    await queryRunner.query(`DROP INDEX "IDX_custom_list_mdblist_id"`);
    await queryRunner.query(`DROP INDEX "IDX_custom_list_collection_order"`);
    await queryRunner.query(`ALTER TABLE "custom_list" DROP COLUMN "metadata"`);
    await queryRunner.query(
      `ALTER TABLE "custom_list" DROP COLUMN "lastValidatedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" DROP COLUMN "selectedArtworkPosterPath"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" DROP COLUMN "selectedArtworkTmdbId"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" DROP COLUMN "mdblistId"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" DROP COLUMN "sortOrder"`
    );
    await queryRunner.query(`ALTER TABLE "custom_list" DROP COLUMN "enabled"`);
  }
}
