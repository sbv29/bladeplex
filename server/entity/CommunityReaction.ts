import type { CommunityReactionValue } from '@server/constants/communityReaction';
import type { MediaType } from '@server/constants/media';
import { User } from '@server/entity/User';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Unique('UQ_community_reaction_user_media', ['user', 'mediaType', 'tmdbId'])
@Index('IDX_community_reaction_media', ['mediaType', 'tmdbId'])
export class CommunityReaction {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => User, (user) => user.communityReactions, {
    onDelete: 'CASCADE',
  })
  @Index()
  public user: User;

  @Column({ type: 'varchar' })
  public mediaType: MediaType;

  @Column({ type: 'integer' })
  public tmdbId: number;

  @Column({ type: 'varchar' })
  public reaction: CommunityReactionValue;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<CommunityReaction>) {
    Object.assign(this, init);
  }
}
