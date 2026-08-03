import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomLists1785370000000 implements MigrationInterface {
  name = 'AddCustomLists1785370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "custom_list" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "provider" varchar NOT NULL, "listType" varchar NOT NULL, "title" varchar NOT NULL, "sourceUrl" varchar NOT NULL, "username" varchar NOT NULL DEFAULT (''), "slug" varchar NOT NULL, "mediaType" varchar NOT NULL DEFAULT ('movie'), "itemCount" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "CHK_custom_list_provider" CHECK ("provider" IN ('mdblist')), CONSTRAINT "CHK_custom_list_type" CHECK ("listType" IN ('official', 'public')), CONSTRAINT "CHK_custom_list_media_type" CHECK ("mediaType" IN ('movie')))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_custom_list_source" ON "custom_list" ("provider", "listType", "username", "slug", "mediaType")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_custom_list_source"`);
    await queryRunner.query(`DROP TABLE "custom_list"`);
  }
}
