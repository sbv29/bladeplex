export interface PwaInstallEnvironment {
  isAndroid: boolean;
  isAppleDesktop: boolean;
  isAppleMobile: boolean;
  isInstallPromptAvailable: boolean;
  isSecureContext: boolean;
  isStandalone: boolean;
}

export type PwaInstallMode =
  | 'android-instructions'
  | 'apple-instructions'
  | 'native'
  | 'unavailable';

export interface PwaInstallController {
  disableScreenshots?: boolean;
  hideDialog: () => void;
  install: () => void;
  isApple26Plus?: boolean;
  isAppleDesktopPlatform?: boolean;
  isAppleMobilePlatform?: boolean;
  manualHowTo?: boolean;
  showDialog: (forced?: boolean) => void;
}

interface PwaInstallRequestOptions {
  isAppleDesktop?: boolean;
}

export const PWA_INSTALL_PROMOTION_DISMISSED_AT_KEY =
  'bladeplex.pwaInstallPromotionDismissedAt.v2';
export const PWA_INSTALL_PROMOTION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

interface PwaInstallPromotionStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

const isDesktopSafari = (userAgent: string) =>
  /Macintosh/.test(userAgent) &&
  /Safari/.test(userAgent) &&
  !/(Chrome|Chromium|CriOS|Edg|OPR)/.test(userAgent);

export const getPwaInstallEnvironment = (): PwaInstallEnvironment => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isAndroid: false,
      isAppleDesktop: false,
      isAppleMobile: false,
      isInstallPromptAvailable: false,
      isSecureContext: false,
      isStandalone: false,
    };
  }

  const userAgent = navigator.userAgent;
  const isIPad =
    /iPad/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
  const isAppleMobile = /iPhone|iPod/.test(userAgent) || isIPad;

  return {
    isAndroid: /Android/.test(userAgent),
    isAppleDesktop: !isIPad && isDesktopSafari(userAgent),
    isAppleMobile,
    isInstallPromptAvailable: false,
    isSecureContext: window.isSecureContext,
    isStandalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as NavigatorWithStandalone).standalone === true ||
      document.referrer.startsWith('android-app://'),
  };
};

export const getPwaInstallMode = (
  environment: PwaInstallEnvironment
): PwaInstallMode => {
  if (environment.isStandalone || !environment.isSecureContext) {
    return 'unavailable';
  }

  if (environment.isAppleMobile || environment.isAppleDesktop) {
    return 'apple-instructions';
  }

  if (environment.isInstallPromptAvailable) {
    return 'native';
  }

  if (environment.isAndroid) {
    return 'android-instructions';
  }

  return 'unavailable';
};

export const requestPwaInstall = (
  controller: PwaInstallController,
  mode: PwaInstallMode,
  options: PwaInstallRequestOptions = {}
) => {
  if (mode === 'native') {
    controller.showDialog(true);
  } else if (mode === 'apple-instructions') {
    // Match the demo's forceStyle() path so iOS/iPadOS browser heuristics cannot
    // leave the component rendering its Chromium template.
    controller.isAppleMobilePlatform = !options.isAppleDesktop;
    controller.isAppleDesktopPlatform = options.isAppleDesktop === true;
    controller.isApple26Plus = true;
    controller.disableScreenshots = true;
    controller.manualHowTo = false;
    controller.hideDialog();
    controller.showDialog(true);
  } else if (mode === 'android-instructions') {
    controller.showDialog(true);
  }
};

export const isPwaInstallPromotionDismissed = (
  storage: PwaInstallPromotionStorage,
  now = Date.now()
) => {
  const dismissedAt = Number(
    storage.getItem(PWA_INSTALL_PROMOTION_DISMISSED_AT_KEY)
  );

  return (
    Number.isFinite(dismissedAt) &&
    dismissedAt > 0 &&
    now - dismissedAt < PWA_INSTALL_PROMOTION_COOLDOWN_MS
  );
};

export const dismissPwaInstallPromotion = (
  storage: PwaInstallPromotionStorage,
  now = Date.now()
) => {
  storage.setItem(PWA_INSTALL_PROMOTION_DISMISSED_AT_KEY, String(now));
};
