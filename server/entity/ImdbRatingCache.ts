import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class ImdbRatingCache {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ unique: true })
  @Index()
  public tmdbId: number;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  public imdbId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  public title?: string | null;

  @Column({ type: 'int', nullable: true })
  public ratingTenths?: number | null;

  @Column({ type: 'int', nullable: true })
  public voteCount?: number | null;

  @Column({ type: 'varchar', nullable: true })
  public url?: string | null;

  @Column({ type: 'boolean', default: false })
  public missing: boolean;

  @Column({ type: 'int', default: 0 })
  public failureCount: number;

  @DbAwareColumn({ type: 'datetime', nullable: true })
  public lastAttemptAt?: Date | null;

  @DbAwareColumn({ type: 'datetime', nullable: true })
  public lastSuccessAt?: Date | null;

  @CreateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;
}
