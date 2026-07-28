import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaTypeToImdbRatingCache1785400000000 implements MigrationInterface {
  name = 'AddMediaTypeToImdbRatingCache1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "imdb_rating_cache" ADD "mediaType" character varying NOT NULL DEFAULT 'movie'`
    );
    await queryRunner.query(
      `ALTER TABLE "imdb_rating_cache" DROP CONSTRAINT "UQ_imdb_rating_cache_tmdb"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_media_type" ON "imdb_rating_cache" ("mediaType")`
    );
    await queryRunner.query(
      `ALTER TABLE "imdb_rating_cache" ADD CONSTRAINT "UQ_imdb_rating_cache_tmdb_media_type" UNIQUE ("tmdbId", "mediaType")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "imdb_rating_cache" DROP CONSTRAINT "UQ_imdb_rating_cache_tmdb_media_type"`
    );
    await queryRunner.query(`DROP INDEX "IDX_imdb_rating_cache_media_type"`);
    await queryRunner.query(
      `ALTER TABLE "imdb_rating_cache" DROP COLUMN "mediaType"`
    );
    await queryRunner.query(
      `ALTER TABLE "imdb_rating_cache" ADD CONSTRAINT "UQ_imdb_rating_cache_tmdb" UNIQUE ("tmdbId")`
    );
  }
}
