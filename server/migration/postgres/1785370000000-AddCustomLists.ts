import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomLists1785370000000 implements MigrationInterface {
  name = 'AddCustomLists1785370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "custom_list" ("id" SERIAL NOT NULL, "provider" character varying NOT NULL, "listType" character varying NOT NULL, "title" character varying NOT NULL, "sourceUrl" character varying NOT NULL, "username" character varying NOT NULL DEFAULT '', "slug" character varying NOT NULL, "mediaType" character varying NOT NULL DEFAULT 'movie', "itemCount" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_custom_list_provider" CHECK ("provider" IN ('mdblist')), CONSTRAINT "CHK_custom_list_type" CHECK ("listType" IN ('official', 'public')), CONSTRAINT "CHK_custom_list_media_type" CHECK ("mediaType" IN ('movie')), CONSTRAINT "PK_custom_list" PRIMARY KEY ("id"))`
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
