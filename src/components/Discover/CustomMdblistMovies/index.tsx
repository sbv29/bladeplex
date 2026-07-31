import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import { useBatchUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowPathRoundedSquareIcon,
  BarsArrowDownIcon,
  FunnelIcon,
} from '@heroicons/react/24/solid';
import type { MovieResult } from '@server/models/Search';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.CustomMdblistMovies', {
  fallbackTitle: 'MDBList Movies',
  shuffle: 'Shuffle',
  rank: 'MDBList Rank',
  releaseNewest: 'Release Date: Newest',
  releaseOldest: 'Release Date: Oldest',
  titleAsc: 'Title: A–Z',
  titleDesc: 'Title: Z–A',
  rating: 'Rating: Highest',
  popularity: 'Popularity',
  random: 'Shuffled',
  genre: 'Genre ID',
  yearFrom: 'Year From',
  yearTo: 'Year To',
  ratingMinimum: 'Minimum Rating',
  hideAvailable: 'Hide Available',
});

const allowedSorts = new Set([
  'rank',
  'random',
  'release_date.desc',
  'release_date.asc',
  'title.asc',
  'title.desc',
  'rating.desc',
  'popularity.desc',
]);

const CustomMdblistMovies = ({ listId }: { listId: number }) => {
  const intl = useIntl();
  const router = useRouter();
  const updateQuery = useBatchUpdateQueryParams({});
  const sortBy =
    typeof router.query.sortBy === 'string' &&
    allowedSorts.has(router.query.sortBy)
      ? router.query.sortBy
      : 'rank';
  const seed =
    typeof router.query.seed === 'string' ? router.query.seed : undefined;
  const options = {
    sortBy,
    ...(seed ? { seed } : {}),
    ...(typeof router.query.genre === 'string'
      ? { genre: router.query.genre }
      : {}),
    ...(typeof router.query.yearGte === 'string'
      ? { yearGte: router.query.yearGte }
      : {}),
    ...(typeof router.query.yearLte === 'string'
      ? { yearLte: router.query.yearLte }
      : {}),
    ...(typeof router.query.voteAverageGte === 'string'
      ? { voteAverageGte: router.query.voteAverageGte }
      : {}),
    ...(router.query.hideAvailable === 'true' ? { hideAvailable: 'true' } : {}),
  };
  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
    firstResultData,
  } = useDiscover<MovieResult, { title: string; itemCount: number }>(
    `/api/v1/discover/mdblist/collections/${listId}/movies`,
    options
  );
  const title =
    firstResultData?.title ?? intl.formatMessage(messages.fallbackTitle);

  if (error)
    return (
      <ErrorPage
        statusCode={
          axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500
        }
      />
    );
  const shuffle = () => {
    const bytes = new Uint32Array(2);
    window.crypto.getRandomValues(bytes);
    updateQuery({
      sortBy: 'random',
      seed: `${bytes[0].toString(36)}${bytes[1].toString(36)}`,
    });
  };
  const changeSort = (value: string) => {
    if (value === 'random') {
      shuffle();
    } else {
      updateQuery({ sortBy: value, seed: undefined });
    }
  };
  const field = (name: string, label: string) => (
    <input
      aria-label={label}
      className="w-28"
      inputMode="numeric"
      placeholder={label}
      value={typeof router.query[name] === 'string' ? router.query[name] : ''}
      onChange={(event) =>
        updateQuery({ [name]: event.target.value || undefined })
      }
    />
  );

  return (
    <>
      <PageTitle title={title} />
      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <Header>{title}</Header>
          {firstResultData && (
            <p className="text-sm text-gray-400">
              {firstResultData.totalResults} usable movies · Powered by MDBList
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-l-md border border-gray-500 bg-gray-800 px-2">
            <BarsArrowDownIcon className="h-5 w-5" />
          </span>
          <select
            aria-label="Sort collection"
            value={sortBy}
            onChange={(event) => changeSort(event.target.value)}
          >
            <option value="rank">{intl.formatMessage(messages.rank)}</option>
            <option value="random">
              {intl.formatMessage(messages.random)}
            </option>
            <option value="release_date.desc">
              {intl.formatMessage(messages.releaseNewest)}
            </option>
            <option value="release_date.asc">
              {intl.formatMessage(messages.releaseOldest)}
            </option>
            <option value="title.asc">
              {intl.formatMessage(messages.titleAsc)}
            </option>
            <option value="title.desc">
              {intl.formatMessage(messages.titleDesc)}
            </option>
            <option value="rating.desc">
              {intl.formatMessage(messages.rating)}
            </option>
            <option value="popularity.desc">
              {intl.formatMessage(messages.popularity)}
            </option>
          </select>
          <Button buttonType="primary" onClick={shuffle}>
            <ArrowPathRoundedSquareIcon />
            <span>{intl.formatMessage(messages.shuffle)}</span>
          </Button>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg bg-gray-800 p-3 ring-1 ring-gray-700">
        <FunnelIcon className="h-5 w-5 text-gray-400" />
        {field('genre', intl.formatMessage(messages.genre))}
        {field('yearGte', intl.formatMessage(messages.yearFrom))}
        {field('yearLte', intl.formatMessage(messages.yearTo))}
        {field('voteAverageGte', intl.formatMessage(messages.ratingMinimum))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={router.query.hideAvailable === 'true'}
            onChange={(event) =>
              updateQuery({
                hideAvailable: event.target.checked ? 'true' : undefined,
              })
            }
          />
          {intl.formatMessage(messages.hideAvailable)}
        </label>
      </div>
      <ListView
        items={titles}
        isEmpty={isEmpty}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
      />
    </>
  );
};

export default CustomMdblistMovies;
