import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateCollectionsFromCustomLists1785543000000 implements MigrationInterface {
  name = 'SeparateCollectionsFromCustomLists1785543000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_list" ADD "isCollection" boolean NOT NULL DEFAULT (0)`
    );
    await queryRunner.query(`DROP INDEX "UQ_custom_list_source"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_custom_list_source" ON "custom_list" ("provider", "listType", "username", "slug", "mediaType", "isCollection")`
    );
    await queryRunner.query(
      `INSERT INTO "custom_list" (
         "provider", "listType", "title", "sourceUrl", "username", "slug",
         "mediaType", "itemCount", "isCollection", "enabled", "sortOrder",
         "mdblistId", "selectedArtworkTmdbId", "selectedArtworkPosterPath",
         "artworkOverlayColor", "lastValidatedAt", "metadata", "createdAt", "updatedAt"
       )
       SELECT
         "provider", "listType", "title", "sourceUrl", "username", "slug",
         "mediaType", "itemCount", 1, "enabled", "sortOrder", "mdblistId",
         "selectedArtworkTmdbId", "selectedArtworkPosterPath",
         "artworkOverlayColor", "lastValidatedAt", "metadata", "createdAt", "updatedAt"
       FROM "custom_list" WHERE "provider" = 'mdblist' AND "isCollection" = 0`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "custom_list" WHERE "isCollection" = 1`
    );
    await queryRunner.query(`DROP INDEX "UQ_custom_list_source"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_custom_list_source" ON "custom_list" ("provider", "listType", "username", "slug", "mediaType")`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" DROP COLUMN "isCollection"`
    );
  }
}
