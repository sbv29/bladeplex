import CustomMdblistTv from '@app/components/Discover/CustomMdblistTv';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';

const MdblistTvCollectionPage: NextPage = () => {
  const router = useRouter();
  const listId = Number(router.query.listId);
  if (!Number.isSafeInteger(listId) || listId <= 0) return null;
  return <CustomMdblistTv listId={listId} collection />;
};

export default MdblistTvCollectionPage;
