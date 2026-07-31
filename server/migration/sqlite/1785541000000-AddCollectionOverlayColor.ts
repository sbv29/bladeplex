import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCollectionOverlayColor1785541000000 implements MigrationInterface {
  name = 'AddCollectionOverlayColor1785541000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_list" ADD "artworkOverlayColor" varchar`
    );
    await queryRunner.query(
      `UPDATE "custom_list" SET "artworkOverlayColor" = '#4f46e5' WHERE "mediaType" = 'movie' AND "provider" = 'mdblist'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_list" DROP COLUMN "artworkOverlayColor"`
    );
  }
}
