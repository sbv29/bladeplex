import SettingsLayout from '@app/components/Settings/SettingsLayout';
import SettingsMdblistCollections from '@app/components/Settings/SettingsMdblistCollections';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';

const MdblistCollectionsSettingsPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsMdblistCollections />
    </SettingsLayout>
  );
};

export default MdblistCollectionsSettingsPage;
