import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTvCustomLists1785450000000 implements MigrationInterface {
  name = 'AddTvCustomLists1785450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_list" DROP CONSTRAINT "CHK_custom_list_media_type"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" ADD CONSTRAINT "CHK_custom_list_media_type" CHECK ("mediaType" IN ('movie', 'tv'))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "custom_list" WHERE "mediaType" = 'tv'`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" DROP CONSTRAINT "CHK_custom_list_media_type"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_list" ADD CONSTRAINT "CHK_custom_list_media_type" CHECK ("mediaType" IN ('movie'))`
    );
  }
}
