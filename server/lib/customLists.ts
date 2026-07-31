import { DiscoverSliderType } from '@server/constants/discover';
import { getRepository } from '@server/datasource';
import CustomList from '@server/entity/CustomList';
import DiscoverSlider from '@server/entity/DiscoverSlider';

export const bootstrapCustomListSliders = async (): Promise<void> => {
  const customListRepository = getRepository(CustomList);
  const sliderRepository = getRepository(DiscoverSlider);
  const customLists = await customListRepository.find({
    order: { createdAt: 'ASC' },
  });

  const maximumOrder = await sliderRepository
    .createQueryBuilder('slider')
    .select('MAX(slider.order)', 'max')
    .getRawOne<{ max: number | null }>();
  let nextOrder = Number(maximumOrder?.max ?? -1) + 1;

  for (const customList of customLists) {
    // Movie lists are rendered inside the single MDBList Collections row.
    // Retain legacy rows in the database for rollback compatibility, but do
    // not create new per-collection movie sliders.
    if (customList.mediaType === 'movie') {
      continue;
    }
    const sliderType = DiscoverSliderType.MDBLIST_CUSTOM_TV;
    const existingSlider = await sliderRepository.findOne({
      where: {
        type: sliderType,
        data: String(customList.id),
      },
    });

    if (existingSlider) {
      if (!existingSlider.isBuiltIn) {
        existingSlider.isBuiltIn = true;
        await sliderRepository.save(existingSlider);
      }
      continue;
    }

    await sliderRepository.save(
      new DiscoverSlider({
        type: sliderType,
        title: customList.title,
        data: String(customList.id),
        enabled: true,
        isBuiltIn: true,
        order: nextOrder++,
      })
    );
  }
};
