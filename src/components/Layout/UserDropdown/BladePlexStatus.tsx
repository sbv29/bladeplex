import defineMessages from '@app/utils/defineMessages';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useIntl } from 'react-intl';

export type BladePlexStatus =
  | 'operational'
  | 'degraded'
  | 'plex_down'
  | 'radarr_down'
  | 'sonarr_down'
  | 'downloads_down'
  | 'unknown';

export interface BladePlexStatusResponse {
  status: BladePlexStatus;
  statusPageUrl: string;
}

const messages = defineMessages('components.Layout.UserDropdown', {
  allSystemsOperational: 'All systems operational',
  someServicesUnavailable: 'Some services are unavailable',
  plexCurrentlyUnavailable: 'Media streaming (Plex) is unavailable',
  movieRequestsUnavailable: 'Movie Downloading/Requesting is unavailable',
  tvRequestsUnavailable: 'TV Downloading/Requesting is unavailable',
  downloadsUnavailable: 'Downloads are currently unavailable',
  serviceStatusUnavailable: 'Service status unavailable',
  openStatusPage: 'Open BladePlex status page',
});

export const statusStyles: Record<
  BladePlexStatus,
  { attention: string; dot: string; ring: string }
> = {
  operational: {
    attention: 'status-ring-pulse-green',
    dot: 'bg-green-400',
    ring: 'ring-green-500/70',
  },
  degraded: {
    attention: 'status-ring-pulse-amber',
    dot: 'bg-amber-400',
    ring: 'ring-amber-500/70',
  },
  plex_down: {
    attention: 'status-ring-pulse-red',
    dot: 'bg-red-400',
    ring: 'ring-red-500/70',
  },
  radarr_down: {
    attention: 'status-ring-pulse-red',
    dot: 'bg-red-400',
    ring: 'ring-red-500/70',
  },
  sonarr_down: {
    attention: 'status-ring-pulse-red',
    dot: 'bg-red-400',
    ring: 'ring-red-500/70',
  },
  downloads_down: {
    attention: 'status-ring-pulse-red',
    dot: 'bg-red-400',
    ring: 'ring-red-500/70',
  },
  unknown: { attention: '', dot: 'bg-gray-500', ring: 'ring-gray-600' },
};

export const BladePlexStatusRow = ({
  status,
  statusPageUrl,
}: BladePlexStatusResponse) => {
  const intl = useIntl();
  const statusMessage = {
    operational: messages.allSystemsOperational,
    degraded: messages.someServicesUnavailable,
    plex_down: messages.plexCurrentlyUnavailable,
    radarr_down: messages.movieRequestsUnavailable,
    sonarr_down: messages.tvRequestsUnavailable,
    downloads_down: messages.downloadsUnavailable,
    unknown: messages.serviceStatusUnavailable,
  }[status];

  return (
    <a
      href={statusPageUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={intl.formatMessage(messages.openStatusPage)}
      className="flex items-center rounded px-4 py-2 text-sm font-medium text-gray-300 transition duration-150 ease-in-out hover:bg-gray-700/70 hover:text-white focus:bg-gray-700/70 focus:text-white focus:outline-none"
      data-testid="user-menu-service-status"
    >
      <span
        className={`mr-3 h-2.5 w-2.5 flex-none rounded-full ${statusStyles[status].dot} ${statusStyles[status].attention}`}
        aria-hidden="true"
        data-testid="user-menu-service-status-dot"
      />
      <span className="min-w-0 flex-1">
        {intl.formatMessage(statusMessage)}
      </span>
      <ArrowTopRightOnSquareIcon
        className="ml-2 h-4 w-4 flex-none text-gray-500"
        aria-hidden="true"
      />
    </a>
  );
};
