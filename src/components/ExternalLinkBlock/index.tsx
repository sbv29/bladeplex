import ImdbLogo from '@app/assets/services/imdb.svg';
import TmdbLogo from '@app/assets/services/tmdb.svg';
import TvdbLogo from '@app/assets/services/tvdb.svg';
import useLocale from '@app/hooks/useLocale';
import { MediaType } from '@server/constants/media';

type ExternalLinkType = 'movie' | 'tv' | 'person';

interface ExternalLinkBlockProps {
  mediaType: ExternalLinkType;
  tmdbId?: number;
  tvdbId?: number;
  imdbId?: string;
}

const ExternalLinkBlock = ({
  mediaType,
  tmdbId,
  tvdbId,
  imdbId,
}: ExternalLinkBlockProps) => {
  const { locale } = useLocale();

  return (
    <div className="flex w-full items-center justify-center space-x-2 sm:space-x-5">
      {tmdbId && mediaType === 'person' && (
        <a
          href={`https://www.themoviedb.org/${mediaType}/${tmdbId}?language=${locale}`}
          className="w-8 opacity-50 transition duration-300 hover:opacity-100"
          target="_blank"
          rel="noreferrer"
        >
          <TmdbLogo />
        </a>
      )}
      {tvdbId && mediaType === MediaType.TV && (
        <a
          href={`http://www.thetvdb.com/?tab=series&id=${tvdbId}`}
          className="w-9 opacity-50 transition duration-300 hover:opacity-100"
          target="_blank"
          rel="noreferrer"
        >
          <TvdbLogo />
        </a>
      )}
      {imdbId && mediaType === 'person' && (
        <a
          href={`https://www.imdb.com/name/${imdbId}`}
          className="w-8 opacity-50 transition duration-300 hover:opacity-100"
          target="_blank"
          rel="noreferrer"
        >
          <ImdbLogo />
        </a>
      )}
    </div>
  );
};

export default ExternalLinkBlock;
