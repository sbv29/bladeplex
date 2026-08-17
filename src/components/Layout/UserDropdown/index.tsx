import CachedImage from '@app/components/Common/CachedImage';
import {
  BladePlexStatusRow,
  statusStyles,
  type BladePlexStatusResponse,
} from '@app/components/Layout/UserDropdown/BladePlexStatus';
import MiniQuotaDisplay from '@app/components/Layout/UserDropdown/MiniQuotaDisplay';
import StatusOnboarding from '@app/components/Layout/UserDropdown/StatusOnboarding';
import { SettingsContext } from '@app/context/SettingsContext';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import type { PwaInstallMode } from '@app/utils/pwaInstall';
import { Menu, Transition } from '@headlessui/react';
import {
  ArrowDownTrayIcon,
  ArrowRightOnRectangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { CogIcon, UserIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import type { LinkProps } from 'next/link';
import Link from 'next/link';
import { Fragment, forwardRef, useContext } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Layout.UserDropdown', {
  myprofile: 'Profile',
  settings: 'Settings',
  requests: 'Requests',
  installBladePlex: 'Install BladePlex',
  signout: 'Sign Out',
});

const ForwardedLink = forwardRef<
  HTMLAnchorElement,
  LinkProps & React.ComponentPropsWithoutRef<'a'>
>(({ href, children, ...rest }, ref) => {
  return (
    <Link href={href} ref={ref} {...rest}>
      {children}
    </Link>
  );
});

ForwardedLink.displayName = 'ForwardedLink';

interface UserDropdownProps {
  onInstallPwa: () => void;
  pwaInstallMode: PwaInstallMode;
}

const UserDropdown = ({ onInstallPwa, pwaInstallMode }: UserDropdownProps) => {
  const intl = useIntl();
  const { currentSettings } = useContext(SettingsContext);
  const { user, revalidate, hasPermission } = useUser();
  const statusIndicatorEnabled = currentSettings.statusIndicatorEnabled;
  const { data: serviceStatus } = useSWR<BladePlexStatusResponse>(
    statusIndicatorEnabled ? '/api/v1/bladeplex-status' : null,
    { refreshInterval: 2 * 60 * 1000 }
  );
  const displayedStatus = serviceStatus?.status ?? 'unknown';

  const logout = async () => {
    const response = await axios.post('/api/v1/auth/logout');

    if (response.data?.status === 'ok') {
      revalidate();
    }
  };

  return (
    <Menu as="div" className="relative ml-3">
      <div>
        <Menu.Button
          className={`flex max-w-xs items-center rounded-full text-sm focus:outline-none ${
            statusIndicatorEnabled
              ? `ring-2 ${statusStyles[displayedStatus].ring} ${statusStyles[displayedStatus].attention} hover:ring-opacity-100 focus:ring-opacity-100`
              : ''
          }`}
          data-testid="user-menu"
        >
          <CachedImage
            type="avatar"
            className="h-8 w-8 rounded-full object-cover sm:h-10 sm:w-10"
            src={user ? user.avatar : ''}
            alt=""
            width={40}
            height={40}
          />
        </Menu.Button>
      </div>
      {statusIndicatorEnabled && (
        <StatusOnboarding
          userId={user?.id}
          revision={currentSettings.statusIndicatorRevision}
        />
      )}
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
        appear
      >
        <Menu.Items className="absolute right-0 mt-2 w-72 origin-top-right rounded-md shadow-lg focus:outline-none">
          <div className="divide-y divide-gray-700 rounded-md bg-gray-800/80 ring-1 ring-gray-700 backdrop-blur">
            <div className="flex flex-col space-y-4 px-4 py-4">
              <div className="flex items-center space-x-2">
                <CachedImage
                  type="avatar"
                  className={`h-8 w-8 rounded-full object-cover sm:h-10 sm:w-10 ${
                    statusIndicatorEnabled
                      ? `ring-2 ${statusStyles[displayedStatus].ring} ${statusStyles[displayedStatus].attention}`
                      : ''
                  }`}
                  src={user ? user.avatar : ''}
                  alt=""
                  width={40}
                  height={40}
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xl font-semibold text-gray-200">
                    {user?.displayName}
                  </span>
                  {user?.displayName?.toLowerCase() !== user?.email && (
                    <span className="truncate text-sm text-gray-400">
                      {user?.email}
                    </span>
                  )}
                </div>
              </div>
              {user && <MiniQuotaDisplay userId={user?.id} />}
            </div>
            <div className="p-1">
              <Menu.Item>
                {({ active }) => (
                  <ForwardedLink
                    href={`/profile`}
                    className={`flex items-center rounded px-4 py-2 text-sm font-medium text-gray-200 transition duration-150 ease-in-out ${
                      active
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                        : ''
                    }`}
                    data-testid="user-menu-profile"
                  >
                    <UserIcon className="mr-2 inline h-5 w-5" />
                    <span>{intl.formatMessage(messages.myprofile)}</span>
                  </ForwardedLink>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <ForwardedLink
                    href={
                      hasPermission(
                        [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
                        { type: 'or' }
                      )
                        ? `/users/${user?.id}/requests?filter=all`
                        : '/requests'
                    }
                    className={`flex items-center rounded px-4 py-2 text-sm font-medium text-gray-200 transition duration-150 ease-in-out ${
                      active
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                        : ''
                    }`}
                    data-testid="user-menu-settings"
                  >
                    <ClockIcon className="mr-2 inline h-5 w-5" />
                    <span>{intl.formatMessage(messages.requests)}</span>
                  </ForwardedLink>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <ForwardedLink
                    href={`/profile/settings`}
                    className={`flex items-center rounded px-4 py-2 text-sm font-medium text-gray-200 transition duration-150 ease-in-out ${
                      active
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                        : ''
                    }`}
                    data-testid="user-menu-settings"
                  >
                    <CogIcon className="mr-2 inline h-5 w-5" />
                    <span>{intl.formatMessage(messages.settings)}</span>
                  </ForwardedLink>
                )}
              </Menu.Item>
              {pwaInstallMode !== 'unavailable' && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`flex w-full items-center rounded px-4 py-2 text-sm font-medium text-gray-200 transition duration-150 ease-in-out ${
                        active
                          ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                          : ''
                      }`}
                      data-testid="user-menu-install-pwa"
                      onClick={onInstallPwa}
                      type="button"
                    >
                      <ArrowDownTrayIcon className="mr-2 inline h-5 w-5" />
                      <span>
                        {intl.formatMessage(messages.installBladePlex)}
                      </span>
                    </button>
                  )}
                </Menu.Item>
              )}
              <Menu.Item>
                {({ active }) => (
                  <a
                    href="#"
                    className={`flex items-center rounded px-4 py-2 text-sm font-medium text-gray-200 transition duration-150 ease-in-out ${
                      active
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                        : ''
                    }`}
                    onClick={() => logout()}
                  >
                    <ArrowRightOnRectangleIcon className="mr-2 inline h-5 w-5" />
                    <span>{intl.formatMessage(messages.signout)}</span>
                  </a>
                )}
              </Menu.Item>
            </div>
            {statusIndicatorEnabled && (
              <div className="p-1">
                <BladePlexStatusRow
                  status={displayedStatus}
                  statusPageUrl={
                    serviceStatus?.statusPageUrl ??
                    currentSettings.statusPageUrl
                  }
                />
              </div>
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default UserDropdown;
