import useSettings from '@app/hooks/useSettings';
import defineMessages from '@app/utils/defineMessages';
import {
  dismissMobileAnnouncement,
  isMobileAnnouncementDismissed,
} from '@app/utils/mobileAnnouncementDismissal';
import { XMarkIcon } from '@heroicons/react/24/solid';
import type { MobileAnnouncementColor } from '@server/lib/settings';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Layout.MobileAnnouncement', {
  dismiss: 'Dismiss announcement',
});

const colorClasses: Record<MobileAnnouncementColor, string> = {
  green: 'border-green-400/60 bg-green-700 text-white',
  blue: 'border-blue-400/60 bg-blue-700 text-white',
  purple: 'border-purple-400/60 bg-purple-700 text-white',
  amber: 'border-amber-300/70 bg-amber-600 text-white',
  red: 'border-red-400/60 bg-red-700 text-white',
  gray: 'border-gray-500 bg-gray-700 text-white',
};

const MobileAnnouncement = () => {
  const intl = useIntl();
  const bannerRef = useRef<HTMLDivElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const { currentSettings } = useSettings();
  const [isClientReady, setIsClientReady] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const {
    mobileAnnouncementEnabled: enabled,
    mobileAnnouncementMessage: message,
    mobileAnnouncementColor: color,
    mobileAnnouncementRevision: revision,
    mobileAnnouncementExpiresAt: expiresAt,
  } = currentSettings;

  useEffect(() => {
    try {
      setIsDismissed(
        isMobileAnnouncementDismissed(window.localStorage, revision)
      );
    } catch {
      setIsDismissed(false);
    }
    setIsClosing(false);
    setIsClientReady(true);
  }, [revision]);

  useEffect(
    () => () => {
      clearTimeout(dismissTimerRef.current);
    },
    []
  );

  useEffect(() => {
    let expirationTimer: ReturnType<typeof setTimeout> | undefined;
    const updateExpiration = () => {
      if (!expiresAt) {
        setIsExpired(false);
        return;
      }

      const expiresAtTime = new Date(expiresAt).getTime();
      if (Number.isNaN(expiresAtTime)) {
        setIsExpired(true);
        return;
      }

      const remaining = expiresAtTime - Date.now();
      setIsExpired(remaining <= 0);
      if (remaining > 0) {
        expirationTimer = setTimeout(
          updateExpiration,
          Math.min(remaining, 60_000)
        );
      }
    };

    updateExpiration();
    return () => clearTimeout(expirationTimer);
  }, [expiresAt]);

  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const handleScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => setIsScrolling(false), 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(scrollTimer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const shouldShow =
    isClientReady &&
    enabled &&
    message.trim().length > 0 &&
    !isDismissed &&
    !isExpired;

  useEffect(() => {
    const root = document.documentElement;
    const updateReservedHeight = () => {
      const height = shouldShow ? (bannerRef.current?.offsetHeight ?? 0) : 0;
      root.style.setProperty('--mobile-announcement-height', `${height}px`);
    };

    updateReservedHeight();
    const observer = new ResizeObserver(updateReservedHeight);
    if (bannerRef.current) {
      observer.observe(bannerRef.current);
    }
    window.addEventListener('resize', updateReservedHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateReservedHeight);
      root.style.removeProperty('--mobile-announcement-height');
    };
  }, [shouldShow]);

  if (!shouldShow) {
    return null;
  }

  const dismiss = () => {
    setIsClosing(true);
    try {
      dismissMobileAnnouncement(window.localStorage, revision);
    } catch {
      // Keep the dismissal in memory when browser storage is unavailable.
    }
    dismissTimerRef.current = setTimeout(() => setIsDismissed(true), 200);
  };

  return (
    <div
      className={`px-2 pb-2 transition-opacity duration-200 motion-reduce:transition-none ${
        isClosing ? 'opacity-0' : isScrolling ? 'opacity-50' : 'opacity-100'
      }`}
      role="note"
      ref={bannerRef}
    >
      <div
        className={`flex items-center rounded-lg border shadow-lg ${colorClasses[color]}`}
        data-testid="mobile-announcement"
      >
        <p className="line-clamp-3 min-w-0 flex-1 break-words px-3 py-2 text-sm leading-5">
          {message}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={intl.formatMessage(messages.dismiss)}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-md text-white/90 transition hover:bg-black/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
        >
          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default MobileAnnouncement;
