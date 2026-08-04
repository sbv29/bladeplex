import '@khmyznikov/pwa-install';

import useSettings from '@app/hooks/useSettings';
import {
  dismissPwaInstallPromotion,
  getPwaInstallEnvironment,
  getPwaInstallMode,
  isPwaInstallPromotionDismissed,
  requestPwaInstall,
  type PwaInstallMode,
} from '@app/utils/pwaInstall';
import type {
  PWAInstallElement,
  PWAInstallProps,
} from '@khmyznikov/pwa-install';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const installerAttributes = {
  'disable-screenshots': 'true',
  'manual-apple': 'true',
  'manual-chrome': 'true',
  'manifest-url': '/site.webmanifest',
} as PWAInstallProps;

interface PwaInstallMenuItemProps {
  installRequest: number;
  onModeChange: (mode: PwaInstallMode) => void;
}

interface WindowWithPwaInstallPrompt extends Window {
  bladeplexPwaInstallPrompt?: NonNullable<
    PWAInstallElement['externalPromptEvent']
  >;
}

const PwaInstallMenuItem = ({
  installRequest,
  onModeChange,
}: PwaInstallMenuItemProps) => {
  const { currentSettings } = useSettings();
  const installerRef = useRef<PWAInstallElement>(null);
  const handledRequest = useRef(installRequest);
  const showAutomatically = useRef(false);
  const [environment, setEnvironment] = useState(getPwaInstallEnvironment);
  const refreshAvailability = useCallback(() => {
    const installer = installerRef.current;
    const browserEnvironment = getPwaInstallEnvironment();

    if (installer && !browserEnvironment.isStandalone) {
      installer.disableScreenshots = true;

      if (
        browserEnvironment.isAppleMobile ||
        browserEnvironment.isAppleDesktop
      ) {
        installer.isAppleMobilePlatform = browserEnvironment.isAppleMobile;
        installer.isAppleDesktopPlatform = browserEnvironment.isAppleDesktop;
        installer.isApple26Plus = true;
        installer.manualHowTo = false;
        installer.styles = browserEnvironment.isAppleMobile
          ? { bottom: 'calc(5rem + env(safe-area-inset-bottom))' }
          : {};
        if (showAutomatically.current) {
          installer.showDialog(true);
        }
      } else if (installer.isInstallAvailable && showAutomatically.current) {
        installer.showDialog();
      }
    }

    setEnvironment({
      ...browserEnvironment,
      isInstallPromptAvailable: installer?.isInstallAvailable ?? false,
      isStandalone:
        browserEnvironment.isStandalone ||
        installer?.isUnderStandaloneMode === true ||
        installer?.isRelatedAppsInstalled === true,
    });
  }, []);

  useEffect(() => {
    const installer = installerRef.current;
    const displayMode = window.matchMedia('(display-mode: standalone)');
    try {
      showAutomatically.current = !isPwaInstallPromotionDismissed(
        window.localStorage
      );
    } catch {
      showAutomatically.current = true;
    }

    const handleDismissal = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail
        ?.message;

      if (message === 'dismissed') {
        showAutomatically.current = false;
        try {
          dismissPwaInstallPromotion(window.localStorage);
        } catch {
          // The current page still honors dismissal when storage is blocked.
        }
      }
    };
    const attachCapturedPrompt = () => {
      const capturedPrompt = (window as WindowWithPwaInstallPrompt)
        .bladeplexPwaInstallPrompt;

      if (
        installer &&
        capturedPrompt &&
        installer.externalPromptEvent !== capturedPrompt
      ) {
        installer.externalPromptEvent = capturedPrompt;
      }
    };

    if (installer) {
      installer.disableScreenshots = true;
      installer.addEventListener(
        'pwa-install-available-event',
        refreshAvailability
      );
      installer.addEventListener(
        'pwa-user-choice-result-event',
        handleDismissal
      );
      attachCapturedPrompt();
    }

    const handleInstalled = () => {
      setEnvironment({
        ...getPwaInstallEnvironment(),
        isInstallPromptAvailable: false,
        isStandalone: true,
      });
    };

    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener(
      'bladeplex-beforeinstallprompt',
      attachCapturedPrompt
    );
    displayMode.addEventListener('change', refreshAvailability);
    refreshAvailability();

    return () => {
      installer?.removeEventListener(
        'pwa-install-available-event',
        refreshAvailability
      );
      installer?.removeEventListener(
        'pwa-user-choice-result-event',
        handleDismissal
      );
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener(
        'bladeplex-beforeinstallprompt',
        attachCapturedPrompt
      );
      displayMode.removeEventListener('change', refreshAvailability);
    };
  }, [refreshAvailability]);

  const mode = getPwaInstallMode(environment);

  useEffect(() => {
    onModeChange(mode);
  }, [mode, onModeChange]);

  const install = useCallback(() => {
    if (installerRef.current) {
      requestPwaInstall(installerRef.current, mode, {
        isAppleDesktop: environment.isAppleDesktop,
      });
    }
  }, [environment.isAppleDesktop, mode]);

  useEffect(() => {
    if (installRequest !== handledRequest.current) {
      handledRequest.current = installRequest;
      install();
    }
  }, [install, installRequest]);

  const installer = createPortal(
    <pwa-install
      {...installerAttributes}
      description="Request and discover media from your server."
      name={currentSettings.applicationTitle || 'BladePlex'}
      ref={installerRef}
    />,
    document.body
  );

  return installer;
};

export default PwaInstallMenuItem;
