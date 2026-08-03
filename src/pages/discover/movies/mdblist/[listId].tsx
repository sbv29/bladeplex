import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import CustomMdblistMovies from '@app/components/Discover/CustomMdblistMovies';
import ErrorPage from '@app/pages/_error';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const CustomMdblistMoviesPage: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || router.query.sortBy !== undefined) {
      return;
    }

    const bytes = new Uint32Array(2);
    window.crypto.getRandomValues(bytes);
    void router.replace(
      {
        pathname: router.pathname,
        query: {
          ...router.query,
          sortBy: 'random',
          seed:
            typeof router.query.seed === 'string'
              ? router.query.seed
              : `${bytes[0].toString(36)}${bytes[1].toString(36)}`,
        },
      },
      undefined,
      { shallow: true }
    );
  }, [router, router.isReady, router.query.sortBy]);

  if (!router.isReady) {
    return <LoadingSpinner />;
  }

  const listId = Number(router.query.listId);
  if (!Number.isSafeInteger(listId) || listId <= 0) {
    return <ErrorPage statusCode={404} />;
  }

  if (router.query.sortBy === undefined) {
    return <LoadingSpinner />;
  }

  return <CustomMdblistMovies listId={listId} />;
};

export default CustomMdblistMoviesPage;
