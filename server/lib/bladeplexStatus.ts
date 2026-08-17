import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios from 'axios';

export const BLADEPLEX_STATUS_URL = 'https://status.sblade.io/';
const STATUS_CACHE_TTL_MS = 2 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 30 * 1000;
const STATUS_REQUEST_TIMEOUT_MS = 3000;

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

interface KumaMonitor {
  id: number;
  name: string;
}

interface KumaStatusPageResponse {
  publicGroupList?: {
    monitorList?: KumaMonitor[];
  }[];
}

interface KumaHeartbeat {
  status: number;
}

interface KumaHeartbeatResponse {
  heartbeatList?: Record<string, KumaHeartbeat[]>;
}

interface StatusCacheEntry {
  value: BladePlexStatusResponse;
  expiresAt: number;
}

const unknownStatus = (
  statusPageUrl = BLADEPLEX_STATUS_URL
): BladePlexStatusResponse => ({
  status: 'unknown',
  statusPageUrl,
});

export const getKumaEndpoints = (statusPageUrl: string) => {
  const parsedUrl = new URL(statusPageUrl);
  const statusPath = parsedUrl.pathname.match(/^(.*)\/status\/([^/]+)\/?$/);
  const basePath = statusPath?.[1] ?? parsedUrl.pathname.replace(/\/$/, '');
  const slug = decodeURIComponent(statusPath?.[2] ?? 'plex');
  const apiBase = `${parsedUrl.origin}${basePath}/api/status-page`;

  return {
    statusPageUrl: parsedUrl.toString(),
    statusPageApiUrl: `${apiBase}/${encodeURIComponent(slug)}`,
    heartbeatApiUrl: `${apiBase}/heartbeat/${encodeURIComponent(slug)}`,
  };
};

let cache: StatusCacheEntry | undefined;
let pendingRequest: Promise<BladePlexStatusResponse> | undefined;

export const mapKumaStatus = (
  statusPage: KumaStatusPageResponse,
  heartbeats: KumaHeartbeatResponse,
  statusPageUrl = BLADEPLEX_STATUS_URL
): BladePlexStatusResponse => {
  const monitors =
    statusPage.publicGroupList?.flatMap((group) => group.monitorList ?? []) ??
    [];
  const plexMonitor = monitors.find(
    (monitor) => monitor.name.trim().toLowerCase() === 'plex'
  );

  if (!plexMonitor || monitors.length === 0 || !heartbeats.heartbeatList) {
    return unknownStatus(statusPageUrl);
  }

  const latestStatus = (monitorId: number) => {
    const monitorHeartbeats = heartbeats.heartbeatList?.[String(monitorId)];
    return monitorHeartbeats?.at(-1)?.status;
  };

  const plexStatus = latestStatus(plexMonitor.id);

  if (plexStatus === undefined) {
    return unknownStatus(statusPageUrl);
  }

  if (plexStatus === 0) {
    return {
      status: 'plex_down',
      statusPageUrl,
    };
  }

  const downMonitorNames = new Set(
    monitors
      .filter((monitor) => latestStatus(monitor.id) === 0)
      .map((monitor) => monitor.name.trim().toLowerCase())
  );

  if (downMonitorNames.has('radarr')) {
    return {
      status: 'radarr_down',
      statusPageUrl,
    };
  }

  if (downMonitorNames.has('sonarr')) {
    return {
      status: 'sonarr_down',
      statusPageUrl,
    };
  }

  if (downMonitorNames.has('sabnzb') || downMonitorNames.has('sabnzbd')) {
    return {
      status: 'downloads_down',
      statusPageUrl,
    };
  }

  const monitorStatuses = monitors.map((monitor) => latestStatus(monitor.id));

  if (monitorStatuses.some((status) => status === undefined)) {
    return unknownStatus(statusPageUrl);
  }

  return {
    status: monitorStatuses.every((status) => status === 1)
      ? 'operational'
      : 'degraded',
    statusPageUrl,
  };
};

export const fetchBladePlexStatus =
  async (): Promise<BladePlexStatusResponse> => {
    const configuredUrl =
      getSettings().main.statusPageUrl || BLADEPLEX_STATUS_URL;
    const endpoints = getKumaEndpoints(configuredUrl);
    const override =
      process.env.NODE_ENV !== 'production'
        ? process.env.BLADEPLEX_STATUS_OVERRIDE
        : undefined;

    if (
      override === 'operational' ||
      override === 'degraded' ||
      override === 'plex_down' ||
      override === 'radarr_down' ||
      override === 'sonarr_down' ||
      override === 'downloads_down' ||
      override === 'unknown'
    ) {
      return { status: override, statusPageUrl: endpoints.statusPageUrl };
    }

    try {
      const [statusPage, heartbeats] = await Promise.all([
        axios.get<KumaStatusPageResponse>(endpoints.statusPageApiUrl, {
          timeout: STATUS_REQUEST_TIMEOUT_MS,
        }),
        axios.get<KumaHeartbeatResponse>(endpoints.heartbeatApiUrl, {
          timeout: STATUS_REQUEST_TIMEOUT_MS,
        }),
      ]);

      return mapKumaStatus(
        statusPage.data,
        heartbeats.data,
        endpoints.statusPageUrl
      );
    } catch (error) {
      logger.warn('Unable to retrieve BladePlex service status', {
        label: 'BladePlex Status',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return unknownStatus(endpoints.statusPageUrl);
    }
  };

export const getBladePlexStatus =
  async (): Promise<BladePlexStatusResponse> => {
    const now = Date.now();

    if (cache && cache.expiresAt > now) {
      return cache.value;
    }

    if (pendingRequest) {
      return pendingRequest;
    }

    pendingRequest = fetchBladePlexStatus().then((value) => {
      cache = {
        value,
        expiresAt:
          Date.now() +
          (value.status === 'unknown'
            ? FAILURE_CACHE_TTL_MS
            : STATUS_CACHE_TTL_MS),
      };
      return value;
    });

    try {
      return await pendingRequest;
    } finally {
      pendingRequest = undefined;
    }
  };

export const resetBladePlexStatusCache = () => {
  cache = undefined;
  pendingRequest = undefined;
};
