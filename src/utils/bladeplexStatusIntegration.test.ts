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
    assert.match(
      read('src/components/Layout/UserDropdown/BladePlexStatus.tsx'),
      /className={`[^`]*statusStyles\[status\]\.dot[^`]*statusStyles\[status\]\.attention[^`]*`}[\s\S]*data-testid="user-menu-service-status-dot"/
    );
  });

  it('maps each status to a subtle avatar ring and localized menu copy', () => {
    const status = read(
      'src/components/Layout/UserDropdown/BladePlexStatus.tsx'
    );
    const englishMessages = JSON.parse(
      read('src/i18n/locale/en.json')
    ) as Record<string, string>;

    assert.match(
      status,
      /operational:[\s\S]*status-ring-pulse-green[\s\S]*ring-green-500\/70/
    );
    assert.match(
      status,
      /degraded:[\s\S]*status-ring-pulse-amber[\s\S]*ring-amber-500\/70/
    );
    assert.match(
      status,
      /plex_down:[\s\S]*status-ring-pulse-red[\s\S]*ring-red-500\/70/
    );
    assert.match(status, /radarr_down:[\s\S]*ring-red-500\/70/);
    assert.match(status, /sonarr_down:[\s\S]*ring-red-500\/70/);
    assert.match(status, /downloads_down:[\s\S]*ring-red-500\/70/);
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
    const settings = read('src/components/Settings/SettingsMain/index.tsx');

    assert.match(dropdown, /useSWR<BladePlexStatusResponse>/);
    assert.match(
      dropdown,
      /statusIndicatorEnabled \? '\/api\/v1\/bladeplex-status' : null/
    );
    assert.match(dropdown, /serviceStatus\?\.status \?\? 'unknown'/);
    assert.match(
      dropdown,
      /divide-y divide-gray-700[\s\S]*<CachedImage[\s\S]*statusIndicatorEnabled[\s\S]*ring-2 \$\{statusStyles\[displayedStatus\]\.ring\} \$\{statusStyles\[displayedStatus\]\.attention\}/
    );
    assert.match(
      dropdown,
      /<StatusOnboarding[\s\S]*userId={user\?\.id}[\s\S]*revision={currentSettings\.statusIndicatorRevision}/
    );
    assert.match(settings, /name="statusIndicatorEnabled"/);
    assert.match(settings, /name="statusPageUrl"/);
    assert.match(settings, /statusPageUrl: values\.statusPageUrl\.trim\(\)/);
  });

  it('anchors a two-step, revisioned onboarding popover to the avatar', () => {
    const dropdown = read('src/components/Layout/UserDropdown/index.tsx');
    const onboarding = read(
      'src/components/Layout/UserDropdown/StatusOnboarding.tsx'
    );

    assert.match(dropdown, /<StatusOnboarding/);
    assert.match(onboarding, /data-testid="status-onboarding"/);
    assert.match(onboarding, /step === 2 \? setStep\(3\) : dismiss\(\)/);
    assert.match(onboarding, /messages\.progress, { step }/);
    assert.match(onboarding, /onTouchStart={handleTouchStart}/);
    assert.match(onboarding, /onTouchEnd={handleTouchEnd}/);
    assert.match(onboarding, /Math\.abs\(deltaX\) < 40/);
    assert.match(onboarding, /touch-pan-y/);
    assert.match(onboarding, /-right-1\.5[\s\S]*sm:-right-0\.5/);
    assert.match(onboarding, /step === 2[\s\S]*<ChevronLeftIcon/);
    assert.match(onboarding, /step === 1[\s\S]*<ChevronRightIcon/);
    assert.match(
      onboarding,
      /step === 1[\s\S]*bg-indigo-600[\s\S]*bg-green-600/
    );
    assert.match(onboarding, /bg-red-600[\s\S]*messages\.accept/);
    assert.match(onboarding, /messages\.acknowledgement/);
    assert.match(
      onboarding,
      /step === 3 \? messages\.acknowledgementTitle : messages\.title/
    );
    assert.match(
      onboarding,
      /{step === 2 && \([\s\S]*messages\.dismiss[\s\S]*<XMarkIcon/
    );
    assert.match(onboarding, /isStatusOnboardingDismissed/);
    assert.match(onboarding, /dismissStatusOnboarding/);
  });

  it('keeps attention pulses subtle and honors reduced motion', () => {
    const styles = read('src/styles/globals.css');

    assert.match(styles, /status-ring-pulse-green 2\.8s ease-in-out infinite/);
    assert.match(
      styles,
      /status-ring-pulse-amber 1\.775s ease-in-out infinite/
    );
    assert.match(styles, /status-ring-pulse-red 0\.75s ease-in-out infinite/);
    assert.match(styles, /prefers-reduced-motion: reduce/);
    assert.match(
      styles,
      /\.status-ring-pulse-green,[\s\S]*\.status-ring-pulse-amber,[\s\S]*\.status-ring-pulse-red[\s\S]*animation: none/
    );
  });
});
