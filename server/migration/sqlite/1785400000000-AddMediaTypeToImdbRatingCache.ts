import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaTypeToImdbRatingCache1785400000000 implements MigrationInterface {
  name = 'AddMediaTypeToImdbRatingCache1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_imdb_rating_cache_imdb"`);
    await queryRunner.query(`DROP INDEX "IDX_imdb_rating_cache_tmdb"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_imdb_rating_cache" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL DEFAULT ('movie'), "imdbId" varchar, "title" varchar, "ratingTenths" integer, "voteCount" integer, "url" varchar, "missing" boolean NOT NULL DEFAULT (0), "failureCount" integer NOT NULL DEFAULT (0), "lastAttemptAt" datetime, "lastSuccessAt" datetime, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_imdb_rating_cache_tmdb_media_type" UNIQUE ("tmdbId", "mediaType"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_imdb_rating_cache" ("id", "tmdbId", "mediaType", "imdbId", "title", "ratingTenths", "voteCount", "url", "missing", "failureCount", "lastAttemptAt", "lastSuccessAt", "createdAt", "updatedAt") SELECT "id", "tmdbId", 'movie', "imdbId", "title", "ratingTenths", "voteCount", "url", "missing", "failureCount", "lastAttemptAt", "lastSuccessAt", "createdAt", "updatedAt" FROM "imdb_rating_cache"`
    );
    await queryRunner.query(`DROP TABLE "imdb_rating_cache"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_imdb_rating_cache" RENAME TO "imdb_rating_cache"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_tmdb" ON "imdb_rating_cache" ("tmdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_media_type" ON "imdb_rating_cache" ("mediaType")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_imdb" ON "imdb_rating_cache" ("imdbId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "imdb_rating_cache" WHERE "mediaType" = 'tv'`
    );
    await queryRunner.query(`DROP INDEX "IDX_imdb_rating_cache_imdb"`);
    await queryRunner.query(`DROP INDEX "IDX_imdb_rating_cache_media_type"`);
    await queryRunner.query(`DROP INDEX "IDX_imdb_rating_cache_tmdb"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_imdb_rating_cache" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "imdbId" varchar, "title" varchar, "ratingTenths" integer, "voteCount" integer, "url" varchar, "missing" boolean NOT NULL DEFAULT (0), "failureCount" integer NOT NULL DEFAULT (0), "lastAttemptAt" datetime, "lastSuccessAt" datetime, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_imdb_rating_cache_tmdb" UNIQUE ("tmdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_imdb_rating_cache" ("id", "tmdbId", "imdbId", "title", "ratingTenths", "voteCount", "url", "missing", "failureCount", "lastAttemptAt", "lastSuccessAt", "createdAt", "updatedAt") SELECT "id", "tmdbId", "imdbId", "title", "ratingTenths", "voteCount", "url", "missing", "failureCount", "lastAttemptAt", "lastSuccessAt", "createdAt", "updatedAt" FROM "imdb_rating_cache"`
    );
    await queryRunner.query(`DROP TABLE "imdb_rating_cache"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_imdb_rating_cache" RENAME TO "imdb_rating_cache"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_tmdb" ON "imdb_rating_cache" ("tmdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_imdb" ON "imdb_rating_cache" ("imdbId")`
    );
  }
}
