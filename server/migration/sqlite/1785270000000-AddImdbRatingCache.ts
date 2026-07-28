import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImdbRatingCache1785270000000 implements MigrationInterface {
  name = 'AddImdbRatingCache1785270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "imdb_rating_cache" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "imdbId" varchar, "title" varchar, "ratingTenths" integer, "voteCount" integer, "url" varchar, "missing" boolean NOT NULL DEFAULT (0), "failureCount" integer NOT NULL DEFAULT (0), "lastAttemptAt" datetime, "lastSuccessAt" datetime, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_imdb_rating_cache_tmdb" UNIQUE ("tmdbId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_tmdb" ON "imdb_rating_cache" ("tmdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_imdb" ON "imdb_rating_cache" ("imdbId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_imdb_rating_cache_imdb"`);
    await queryRunner.query(`DROP INDEX "IDX_imdb_rating_cache_tmdb"`);
    await queryRunner.query(`DROP TABLE "imdb_rating_cache"`);
  }
}
