import GenreCard from '@app/components/GenreCard';
import Slider from '@app/components/Slider';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.MdblistCollectionSlider', {
  moviesTitle: 'Movie Collections',
  tvTitle: 'TV Collections',
  edit: 'Edit {title}',
});

export interface MdblistCollectionTile {
  id: number;
  title: string;
  itemCount: number;
  mediaType: 'movie' | 'tv';
  selectedArtworkPosterPath?: string | null;
  artworkOverlayColor?: string | null;
}

const MdblistCollectionSlider = ({
  mediaType,
}: {
  mediaType: 'movie' | 'tv';
}) => {
  const intl = useIntl();
  const router = useRouter();
  const { user } = useUser();
  const { data, error } = useSWR<MdblistCollectionTile[]>(
    '/api/v1/discover/mdblist/collections',
    { revalidateOnFocus: false }
  );

  const collections = data?.filter((item) => item.mediaType === mediaType);
  if ((collections && collections.length === 0) || error) return null;

  return (
    <>
      <div className="slider-header">
        <div className="slider-title">
          <span>
            {intl.formatMessage(
              mediaType === 'movie' ? messages.moviesTitle : messages.tvTitle
            )}
          </span>
        </div>
      </div>
      <Slider
        sliderKey="mdblist-collections"
        isLoading={!data}
        isEmpty={false}
        items={(collections ?? []).map((collection) => (
          <GenreCard
            key={collection.id}
            name={collection.title}
            image={
              collection.selectedArtworkPosterPath
                ? `https://image.tmdb.org/t/p/w1280${collection.selectedArtworkPosterPath}`
                : undefined
            }
            url={
              mediaType === 'movie'
                ? `/discover/movies/mdblist/${collection.id}`
                : `/discover/tv/mdblist-collection/${collection.id}`
            }
            overlayColor={collection.artworkOverlayColor ?? '#4f46e5'}
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
