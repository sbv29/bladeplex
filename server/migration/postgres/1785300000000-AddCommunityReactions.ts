import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityReactions1785300000000 implements MigrationInterface {
  name = 'AddCommunityReactions1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "community_reaction" ("id" SERIAL NOT NULL, "mediaType" character varying NOT NULL, "tmdbId" integer NOT NULL, "reaction" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" integer NOT NULL, CONSTRAINT "CHK_community_reaction_media_type" CHECK ("mediaType" IN ('movie', 'tv')), CONSTRAINT "CHK_community_reaction_value" CHECK ("reaction" IN ('like', 'dislike')), CONSTRAINT "UQ_community_reaction_user_media" UNIQUE ("userId", "mediaType", "tmdbId"), CONSTRAINT "PK_community_reaction" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_community_reaction_media" ON "community_reaction" ("mediaType", "tmdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_community_reaction_user" ON "community_reaction" ("userId")`
    );
    await queryRunner.query(
      `ALTER TABLE "community_reaction" ADD CONSTRAINT "FK_community_reaction_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_reaction" DROP CONSTRAINT "FK_community_reaction_user"`
    );
    await queryRunner.query(`DROP INDEX "IDX_community_reaction_user"`);
    await queryRunner.query(`DROP INDEX "IDX_community_reaction_media"`);
    await queryRunner.query(`DROP TABLE "community_reaction"`);
  }
}
