import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import { sliderTitles } from '@app/components/Discover/constants';
import useDiscover from '@app/hooks/useDiscover';
import ErrorPage from '@app/pages/_error';
import type { MovieResult } from '@server/models/Search';
import { useIntl } from 'react-intl';

const MdblistStreamingMovies = () => {
  const intl = useIntl();
  const title = intl.formatMessage(
    sliderTitles.mdblistJustwatchStreamingChartMovies
  );
  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
  } = useDiscover<MovieResult>(
    '/api/v1/discover/mdblist/justwatch-streaming-charts/movies'
  );

  if (error) {
    return <ErrorPage statusCode={500} />;
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

export default MdblistStreamingMovies;
