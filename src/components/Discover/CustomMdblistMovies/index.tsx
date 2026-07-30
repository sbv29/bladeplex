import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { MovieResult } from '@server/models/Search';
import axios from 'axios';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.CustomMdblistMovies', {
  fallbackTitle: 'MDBList Movies',
});

const CustomMdblistMovies = ({ listId }: { listId: number }) => {
  const intl = useIntl();
  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
    firstResultData,
  } = useDiscover<MovieResult, { title: string }>(
    `/api/v1/discover/mdblist/lists/${listId}/movies`
  );
  const title =
    firstResultData?.title ?? intl.formatMessage(messages.fallbackTitle);

  if (error) {
    return (
      <ErrorPage
        statusCode={
          axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500
        }
      />
    );
  }

  return (
    <>
      <PageTitle title={title} />
      <div className="mb-5 mt-1">
        <Header>{title}</Header>
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
