import type { MdblistListType } from '@server/api/mdblist/interfaces';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CustomListMediaType = 'movie' | 'tv';
export type CustomListProvider = 'mdblist';

@Entity()
@Index(
  'UQ_custom_list_source',
  ['provider', 'listType', 'username', 'slug', 'mediaType', 'isCollection'],
  { unique: true }
)
@Index('IDX_custom_list_collection_order', [
  'mediaType',
  'enabled',
  'sortOrder',
])
@Index('IDX_custom_list_mdblist_id', ['mdblistId'])
class CustomList {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar' })
  public provider: CustomListProvider;

  @Column({ type: 'varchar' })
  public listType: MdblistListType;

  @Column({ type: 'varchar' })
  public title: string;

  @Column({ type: 'varchar' })
  public sourceUrl: string;

  @Column({ type: 'varchar', default: '' })
  public username: string;

  @Column({ type: 'varchar' })
  public slug: string;

  @Column({ type: 'varchar', default: 'movie' })
  public mediaType: CustomListMediaType;

  @Column({ type: 'int', default: 0 })
  public itemCount: number;

  @Column({ default: false })
  public isCollection: boolean;

  @Column({ default: true })
  public enabled: boolean;

  @Column({ type: 'int', default: 0 })
  public sortOrder: number;

  @Column({ type: 'int', nullable: true })
  public mdblistId?: number | null;

  @Column({ type: 'int', nullable: true })
  public selectedArtworkTmdbId?: number | null;

  @Column({ type: 'varchar', nullable: true })
  public selectedArtworkPosterPath?: string | null;

  @Column({ type: 'varchar', nullable: true })
  public artworkOverlayColor?: string | null;

  @DbAwareColumn({ type: 'datetime', nullable: true })
  public lastValidatedAt?: Date | null;

  /** Bounded, sanitized JSON metadata supplied by the collection service. */
  @Column({ type: 'text', nullable: true })
  public metadata?: string | null;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<CustomList>) {
    Object.assign(this, init);
  }
}

export default CustomList;
