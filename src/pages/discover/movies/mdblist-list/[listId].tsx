import CustomMdblistMovies from '@app/components/Discover/CustomMdblistMovies';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';

const MdblistMovieListPage: NextPage = () => {
  const router = useRouter();
  const listId = Number(router.query.listId);
  if (!Number.isSafeInteger(listId) || listId <= 0) return null;
  return <CustomMdblistMovies listId={listId} collection={false} />;
};

export default MdblistMovieListPage;
