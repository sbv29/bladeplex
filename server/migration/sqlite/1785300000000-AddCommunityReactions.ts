import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityReactions1785300000000 implements MigrationInterface {
  name = 'AddCommunityReactions1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "community_reaction" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL CHECK ("mediaType" IN ('movie', 'tv')), "tmdbId" integer NOT NULL, "reaction" varchar NOT NULL CHECK ("reaction" IN ('like', 'dislike')), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer NOT NULL, CONSTRAINT "UQ_community_reaction_user_media" UNIQUE ("userId", "mediaType", "tmdbId"), CONSTRAINT "FK_community_reaction_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_community_reaction_media" ON "community_reaction" ("mediaType", "tmdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_community_reaction_user" ON "community_reaction" ("userId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_community_reaction_user"`);
    await queryRunner.query(`DROP INDEX "IDX_community_reaction_media"`);
    await queryRunner.query(`DROP TABLE "community_reaction"`);
  }
}
