import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import axios from 'axios';
import {
  BLADEPLEX_STATUS_URL,
  fetchBladePlexStatus,
  getBladePlexStatus,
  getKumaEndpoints,
  mapKumaStatus,
  resetBladePlexStatusCache,
} from './bladeplexStatus';

const statusPage = {
  publicGroupList: [
    {
      monitorList: [
        { id: 1, name: 'plex' },
        { id: 8, name: 'radarr' },
        { id: 9, name: 'sabnzb' },
        { id: 11, name: 'sonarr' },
        { id: 16, name: 'request.sblade.io' },
      ],
    },
  ],
};

const heartbeats = (
  plex: number,
  request: number,
  critical: { radarr?: number; sabnzb?: number; sonarr?: number } = {}
) => ({
  heartbeatList: {
    '1': [{ status: 0 }, { status: plex }],
    '8': [{ status: critical.radarr ?? 1 }],
    '9': [{ status: critical.sabnzb ?? 1 }],
    '11': [{ status: critical.sonarr ?? 1 }],
    '16': [{ status: 0 }, { status: request }],
  },
});

afterEach(() => {
  delete process.env.BLADEPLEX_STATUS_OVERRIDE;
  resetBladePlexStatusCache();
  mock.restoreAll();
});

describe('BladePlex status mapping', () => {
  it('builds Kuma API endpoints from standard and custom-domain URLs', () => {
    assert.deepEqual(getKumaEndpoints('https://kuma.example/status/home'), {
      statusPageUrl: 'https://kuma.example/status/home',
      statusPageApiUrl: 'https://kuma.example/api/status-page/home',
      heartbeatApiUrl: 'https://kuma.example/api/status-page/heartbeat/home',
    });
    assert.deepEqual(getKumaEndpoints(BLADEPLEX_STATUS_URL), {
      statusPageUrl: BLADEPLEX_STATUS_URL,
      statusPageApiUrl: `${BLADEPLEX_STATUS_URL}api/status-page/plex`,
      heartbeatApiUrl: `${BLADEPLEX_STATUS_URL}api/status-page/heartbeat/plex`,
    });
  });

  it('reports operational only when every latest heartbeat is up', () => {
    assert.deepEqual(mapKumaStatus(statusPage, heartbeats(1, 1)), {
      status: 'operational',
      statusPageUrl: BLADEPLEX_STATUS_URL,
    });
  });

  it('reports degraded when another service has an issue', () => {
    assert.equal(
      mapKumaStatus(statusPage, heartbeats(1, 0)).status,
      'degraded'
    );
    assert.equal(
      mapKumaStatus(statusPage, heartbeats(1, 3)).status,
      'degraded'
    );
  });

  it('prioritizes Plex being down over other service states', () => {
    assert.equal(
      mapKumaStatus(statusPage, heartbeats(0, 1)).status,
      'plex_down'
    );
    assert.equal(
      mapKumaStatus(statusPage, heartbeats(0, 0, { radarr: 0, sabnzb: 0 }))
        .status,
      'plex_down'
    );
  });

  it('reports Radarr outages as movie requesting failures', () => {
    assert.equal(
      mapKumaStatus(statusPage, heartbeats(1, 1, { radarr: 0 })).status,
      'radarr_down'
    );
  });

  it('reports Sonarr outages as TV requesting failures', () => {
    assert.equal(
      mapKumaStatus(statusPage, heartbeats(1, 1, { sonarr: 0 })).status,
      'sonarr_down'
    );
  });

  it('reports SABnzbd outages as download failures', () => {
    assert.equal(
      mapKumaStatus(statusPage, heartbeats(1, 1, { sabnzb: 0 })).status,
      'downloads_down'
    );
  });

  it('prioritizes Radarr, then Sonarr, over SABnzbd failures', () => {
    assert.equal(
      mapKumaStatus(
        statusPage,
        heartbeats(1, 1, { radarr: 0, sabnzb: 0, sonarr: 0 })
      ).status,
      'radarr_down'
    );
    assert.equal(
      mapKumaStatus(statusPage, heartbeats(1, 1, { sabnzb: 0, sonarr: 0 }))
        .status,
      'sonarr_down'
    );
  });

  it('uses the neutral state for missing Plex or heartbeat data', () => {
    assert.equal(
      mapKumaStatus({ publicGroupList: [] }, heartbeats(1, 1)).status,
      'unknown'
    );
    assert.equal(
      mapKumaStatus(statusPage, { heartbeatList: {} }).status,
      'unknown'
    );
  });
});

describe('BladePlex status API failure behavior', () => {
  it('caches the mapped result instead of repeating upstream requests', async () => {
    const getMock = mock.method(axios, 'get', async (url: string) => ({
      data: url.includes('/heartbeat/') ? heartbeats(1, 1) : statusPage,
    }));

    assert.equal((await getBladePlexStatus()).status, 'operational');
    assert.equal((await getBladePlexStatus()).status, 'operational');
    assert.equal(getMock.mock.callCount(), 2);
  });

  it('returns a neutral response when the upstream API fails', async () => {
    mock.method(axios, 'get', async () => {
      throw new Error('timeout');
    });

    assert.deepEqual(await fetchBladePlexStatus(), {
      status: 'unknown',
      statusPageUrl: BLADEPLEX_STATUS_URL,
    });
  });

  it('allows local status overrides outside production', async () => {
    process.env.BLADEPLEX_STATUS_OVERRIDE = 'downloads_down';

    assert.equal((await fetchBladePlexStatus()).status, 'downloads_down');
  });
});
