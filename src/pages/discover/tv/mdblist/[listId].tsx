import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import CustomMdblistTv from '@app/components/Discover/CustomMdblistTv';
import ErrorPage from '@app/pages/_error';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';

const CustomMdblistTvPage: NextPage = () => {
  const router = useRouter();
  if (!router.isReady) return <LoadingSpinner />;
  const listId = Number(router.query.listId);
  if (!Number.isSafeInteger(listId) || listId <= 0) {
    return <ErrorPage statusCode={404} />;
  }
  return <CustomMdblistTv listId={listId} />;
};

export default CustomMdblistTvPage;
