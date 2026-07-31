import GenreCard from '@app/components/GenreCard';
import Slider from '@app/components/Slider';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.MdblistCollectionSlider', {
  title: 'MDBList Collections',
  edit: 'Edit {title}',
});

export interface MdblistCollectionTile {
  id: number;
  title: string;
  itemCount: number;
  selectedArtworkPosterPath?: string | null;
}

const MdblistCollectionSlider = () => {
  const intl = useIntl();
  const router = useRouter();
  const { user } = useUser();
  const { data, error } = useSWR<MdblistCollectionTile[]>(
    '/api/v1/discover/mdblist/collections',
    { revalidateOnFocus: false }
  );

  if ((data && data.length === 0) || error) return null;

  return (
    <>
      <div className="slider-header">
        <div className="slider-title">
          <span>{intl.formatMessage(messages.title)}</span>
        </div>
      </div>
      <Slider
        sliderKey="mdblist-collections"
        isLoading={!data}
        isEmpty={false}
        items={(data ?? []).map((collection) => (
          <GenreCard
            key={collection.id}
            name={collection.title}
            image={
              collection.selectedArtworkPosterPath
                ? `https://image.tmdb.org/t/p/w1280${collection.selectedArtworkPosterPath}`
                : undefined
            }
            url={`/discover/movies/mdblist/${collection.id}`}
            onEdit={
              user?.id === 1
                ? () =>
                    router.push(
                      `/settings/mdblist-collections?edit=${collection.id}`
                    )
                : undefined
            }
            editLabel={intl.formatMessage(messages.edit, {
              title: collection.title,
            })}
          />
        ))}
        placeholder={<GenreCard.Placeholder />}
        emptyMessage=""
      />
    </>
  );
};

export default MdblistCollectionSlider;
