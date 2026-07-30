import type { MdblistListType } from '@server/api/mdblist/interfaces';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CustomListMediaType = 'movie';
export type CustomListProvider = 'mdblist';

@Entity()
@Index(
  'UQ_custom_list_source',
  ['provider', 'listType', 'username', 'slug', 'mediaType'],
  { unique: true }
)
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
