import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImdbRatingProviderState1785544000000 implements MigrationInterface {
  name = 'AddImdbRatingProviderState1785544000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "imdb_rating_cache" ADD "source" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "imdb_rating_cache" ADD "nextRetryAt" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_next_retry" ON "imdb_rating_cache" ("nextRetryAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_imdb_rating_cache_next_retry"`);
    await queryRunner.query(
      `ALTER TABLE "imdb_rating_cache" DROP COLUMN "nextRetryAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "imdb_rating_cache" DROP COLUMN "source"`
    );
  }
}
