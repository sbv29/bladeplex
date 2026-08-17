import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('BladePlex profile status rendering', () => {
  it('renders the status row at the bottom of the user dropdown', () => {
    const dropdown = read('src/components/Layout/UserDropdown/index.tsx');
    const statusRowPosition = dropdown.lastIndexOf('<BladePlexStatusRow');
    const menuItemsPosition = dropdown.lastIndexOf('</Menu.Items>');

    assert.ok(statusRowPosition > 0);
    assert.ok(statusRowPosition < menuItemsPosition);
    assert.match(dropdown, /data-testid="user-menu"/);
    assert.match(
      read('src/components/Layout/UserDropdown/BladePlexStatus.tsx'),
      /data-testid="user-menu-service-status"/
    );
  });

  it('maps each status to a subtle avatar ring and localized menu copy', () => {
    const status = read(
      'src/components/Layout/UserDropdown/BladePlexStatus.tsx'
    );
    const englishMessages = JSON.parse(
      read('src/i18n/locale/en.json')
    ) as Record<string, string>;

    assert.match(status, /operational:.*ring-green-500\/70/);
    assert.match(status, /degraded:.*ring-amber-500\/70/);
    assert.match(status, /plex_down:.*ring-red-500\/70/);
    assert.match(status, /radarr_down:.*ring-red-500\/70/);
    assert.match(status, /sonarr_down:.*ring-red-500\/70/);
    assert.match(status, /downloads_down:.*ring-red-500\/70/);
    assert.match(status, /unknown:.*ring-gray-600/);
    assert.equal(
      englishMessages['components.Layout.UserDropdown.allSystemsOperational'],
      'All systems operational'
    );
    assert.equal(
      englishMessages['components.Layout.UserDropdown.someServicesUnavailable'],
      'Some services are unavailable'
    );
    assert.equal(
      englishMessages[
        'components.Layout.UserDropdown.plexCurrentlyUnavailable'
      ],
      'Media streaming (Plex) is unavailable'
    );
    assert.equal(
      englishMessages[
        'components.Layout.UserDropdown.movieRequestsUnavailable'
      ],
      'Movie Downloading/Requesting is unavailable'
    );
    assert.equal(
      englishMessages['components.Layout.UserDropdown.tvRequestsUnavailable'],
      'TV Downloading/Requesting is unavailable'
    );
    assert.equal(
      englishMessages['components.Layout.UserDropdown.downloadsUnavailable'],
      'Downloads are currently unavailable'
    );
  });

  it('loads status asynchronously from the cached BladePlex endpoint', () => {
    const dropdown = read('src/components/Layout/UserDropdown/index.tsx');

    assert.match(dropdown, /useSWR<BladePlexStatusResponse>/);
    assert.match(dropdown, /'\/api\/v1\/bladeplex-status'/);
    assert.match(dropdown, /serviceStatus\?\.status \?\? 'unknown'/);
  });
});
