import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImdbRatingCache1785270000000 implements MigrationInterface {
  name = 'AddImdbRatingCache1785270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "imdb_rating_cache" ("id" SERIAL NOT NULL, "tmdbId" integer NOT NULL, "imdbId" character varying, "title" character varying, "ratingTenths" integer, "voteCount" integer, "url" character varying, "missing" boolean NOT NULL DEFAULT false, "failureCount" integer NOT NULL DEFAULT 0, "lastAttemptAt" TIMESTAMP WITH TIME ZONE, "lastSuccessAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_imdb_rating_cache_tmdb" UNIQUE ("tmdbId"), CONSTRAINT "PK_imdb_rating_cache" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_tmdb" ON "imdb_rating_cache" ("tmdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_imdb_rating_cache_imdb" ON "imdb_rating_cache" ("imdbId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_imdb_rating_cache_imdb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_imdb_rating_cache_tmdb"`);
    await queryRunner.query(`DROP TABLE "imdb_rating_cache"`);
  }
}
