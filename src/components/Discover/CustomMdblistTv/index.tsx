import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { TvResult } from '@server/models/Search';
import axios from 'axios';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.CustomMdblistTv', {
  fallbackTitle: 'MDBList Series',
});

const CustomMdblistTv = ({
  listId,
  collection = false,
}: {
  listId: number;
  collection?: boolean;
}) => {
  const intl = useIntl();
  const discover = useDiscover<TvResult, { title: string }>(
    `/api/v1/discover/mdblist/${collection ? 'collections' : 'lists'}/${listId}/tv`
  );
  const title =
    discover.firstResultData?.title ??
    intl.formatMessage(messages.fallbackTitle);

  if (discover.error) {
    return (
      <ErrorPage
        statusCode={
          axios.isAxiosError(discover.error)
            ? (discover.error.response?.status ?? 500)
            : 500
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
        items={discover.titles}
        isEmpty={discover.isEmpty}
        isLoading={
          discover.isLoadingInitialData ||
          (discover.isLoadingMore && (discover.titles?.length ?? 0) > 0)
        }
        isReachingEnd={discover.isReachingEnd}
        onScrollBottom={discover.fetchMore}
      />
    </>
  );
};

export default CustomMdblistTv;
