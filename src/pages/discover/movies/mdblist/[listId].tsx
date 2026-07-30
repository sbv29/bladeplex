import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import CustomMdblistMovies from '@app/components/Discover/CustomMdblistMovies';
import ErrorPage from '@app/pages/_error';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';

const CustomMdblistMoviesPage: NextPage = () => {
  const router = useRouter();
  if (!router.isReady) {
    return <LoadingSpinner />;
  }

  const listId = Number(router.query.listId);
  if (!Number.isSafeInteger(listId) || listId <= 0) {
    return <ErrorPage statusCode={404} />;
  }

  return <CustomMdblistMovies listId={listId} />;
};

export default CustomMdblistMoviesPage;
