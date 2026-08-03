import { DiscoverSliderType } from '@server/constants/discover';
import { getRepository } from '@server/datasource';
import CustomList from '@server/entity/CustomList';
import DiscoverSlider from '@server/entity/DiscoverSlider';

export const bootstrapCustomListSliders = async (): Promise<void> => {
  const listRepository = getRepository(CustomList);
  const sliderRepository = getRepository(DiscoverSlider);
  const customLists = await listRepository.find({
    where: { isCollection: false },
    order: { createdAt: 'ASC' },
  });
  const maximumOrder = await sliderRepository
    .createQueryBuilder('slider')
    .select('MAX(slider.order)', 'max')
    .getRawOne<{ max: number | null }>();
  let nextOrder = Number(maximumOrder?.max ?? -1) + 1;

  for (const list of customLists) {
    const type =
      list.mediaType === 'tv'
        ? DiscoverSliderType.MDBLIST_CUSTOM_TV
        : DiscoverSliderType.MDBLIST_CUSTOM_MOVIES;
    const slider = await sliderRepository.findOne({
      where: { type, data: String(list.id) },
    });
    if (slider) {
      if (!slider.isBuiltIn) {
        slider.isBuiltIn = true;
        await sliderRepository.save(slider);
      }
      continue;
    }
    await sliderRepository.save(
      new DiscoverSlider({
        type,
        title: list.title,
        data: String(list.id),
        enabled: true,
        isBuiltIn: true,
        order: nextOrder++,
      })
    );
  }
};
