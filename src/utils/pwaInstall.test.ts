import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PWA_INSTALL_PROMOTION_COOLDOWN_MS,
  PWA_INSTALL_PROMOTION_DISMISSED_AT_KEY,
  dismissPwaInstallPromotion,
  getPwaInstallMode,
  isPwaInstallPromotionDismissed,
  requestPwaInstall,
  type PwaInstallEnvironment,
} from './pwaInstall';

const supportedEnvironment: PwaInstallEnvironment = {
  isAndroid: false,
  isAppleDesktop: false,
  isAppleMobile: false,
  isInstallPromptAvailable: true,
  isSecureContext: true,
  isStandalone: false,
};

describe('PWA installation', () => {
  it('shows the install action when a native prompt is available', () => {
    assert.equal(getPwaInstallMode(supportedEnvironment), 'native');
  });

  it('hides the install action when BladePlex is already installed', () => {
    assert.equal(
      getPwaInstallMode({ ...supportedEnvironment, isStandalone: true }),
      'unavailable'
    );
  });

  it('hides the install action on unsupported desktop browsers', () => {
    assert.equal(
      getPwaInstallMode({
        ...supportedEnvironment,
        isInstallPromptAvailable: false,
      }),
      'unavailable'
    );
  });

  it('reopens the Chromium install card', () => {
    let installCalls = 0;
    let instructionCalls = 0;

    requestPwaInstall(
      {
        hideDialog: () => undefined,
        install: () => installCalls++,
        showDialog: () => instructionCalls++,
      },
      'native'
    );

    assert.equal(installCalls, 0);
    assert.equal(instructionCalls, 1);
  });

  it('reopens the Apple Add to Home Screen card on iOS and iPadOS', () => {
    const mode = getPwaInstallMode({
      ...supportedEnvironment,
      isAppleMobile: true,
      isInstallPromptAvailable: false,
    });
    let forced = false;
    let installCalls = 0;
    const controller = {
      disableScreenshots: false,
      hideDialog: () => undefined,
      install: () => installCalls++,
      isApple26Plus: false,
      isAppleDesktopPlatform: false,
      isAppleMobilePlatform: false,
      manualHowTo: false,
      showDialog: (value?: boolean) => {
        forced = value === true;
      },
    };

    requestPwaInstall(controller, mode);

    assert.equal(mode, 'apple-instructions');
    assert.equal(forced, true);
    assert.equal(installCalls, 0);
    assert.equal(controller.isAppleMobilePlatform, true);
    assert.equal(controller.isAppleDesktopPlatform, false);
    assert.equal(controller.isApple26Plus, true);
    assert.equal(controller.disableScreenshots, true);
    assert.equal(controller.manualHowTo, false);
  });

  it('does not mistake the Apple instruction sheet for a native prompt', () => {
    assert.equal(
      getPwaInstallMode({
        ...supportedEnvironment,
        isAppleMobile: true,
        isInstallPromptAvailable: true,
      }),
      'apple-instructions'
    );
  });

  it('does not offer installation from an insecure context', () => {
    assert.equal(
      getPwaInstallMode({
        ...supportedEnvironment,
        isSecureContext: false,
      }),
      'unavailable'
    );
  });

  it('remembers a dismissed promotion for seven days', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const now = 1_000_000;

    dismissPwaInstallPromotion(storage, now);

    assert.equal(
      values.get(PWA_INSTALL_PROMOTION_DISMISSED_AT_KEY),
      String(now)
    );
    assert.equal(PWA_INSTALL_PROMOTION_COOLDOWN_MS, 7 * 24 * 60 * 60 * 1000);
    assert.equal(isPwaInstallPromotionDismissed(storage, now + 1), true);
    assert.equal(
      isPwaInstallPromotionDismissed(
        storage,
        now + PWA_INSTALL_PROMOTION_COOLDOWN_MS
      ),
      false
    );
  });
});
