import SettingsCustomLists from '@app/components/Settings/SettingsCustomLists';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const CustomListsSettingsPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsCustomLists />
    </SettingsLayout>
  );
};

export default CustomListsSettingsPage;
