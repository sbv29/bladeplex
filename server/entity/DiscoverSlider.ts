import { defaultSliders, DiscoverSliderType } from '@server/constants/discover';
import { getRepository } from '@server/datasource';
import logger from '@server/logger';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
class DiscoverSlider {
  public static async bootstrapSliders(): Promise<void> {
    const sliderRepository = getRepository(DiscoverSlider);

    for (const slider of defaultSliders) {
      const existingSlider = await sliderRepository.findOne({
        where: {
          type: slider.type,
        },
      });

      if (!existingSlider) {
        const sliderToCreate = { ...slider };
        if (slider.type === DiscoverSliderType.MDBLIST_COLLECTIONS) {
          const maximum = await sliderRepository
            .createQueryBuilder('slider')
            .select('MAX(slider.order)', 'max')
            .getRawOne<{ max: number | null }>();
          sliderToCreate.order = Number(maximum?.max ?? -1) + 1;
        }
        logger.info('Creating built-in discovery slider', {
          label: 'Discover Slider',
          slider,
        });
        await sliderRepository.save(new DiscoverSlider(sliderToCreate));
      }
    }
  }

  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'int' })
  public type: DiscoverSliderType;

  @Column({ type: 'int' })
  public order: number;

  @Column({ default: false })
  public isBuiltIn: boolean;

  @Column({ default: true })
  public enabled: boolean;

  @Column({ nullable: true })
  // Title is not required for built in sliders because we will
  // use translations for them.
  public title?: string;

  @Column({ nullable: true })
  public data?: string;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<DiscoverSlider>) {
    Object.assign(this, init);
  }
}

export default DiscoverSlider;
