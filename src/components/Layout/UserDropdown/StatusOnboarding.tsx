import defineMessages from '@app/utils/defineMessages';
import {
  dismissStatusOnboarding,
  isStatusOnboardingDismissed,
} from '@app/utils/statusOnboarding';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages(
  'components.Layout.UserDropdown.StatusOnboarding',
  {
    title: 'NEW! THIS IS COOL PLZ READ IT!',
    acknowledgementTitle: 'You definitely read this, right? RIGHT?!',
    statusColors:
      'I added a border to your profile picture. It displays the status of Plex (neat...). Green = good, yellow = kinda bad, red = Scotty broke something.',
    openMenu:
      "If you click your avatar, there is a link on the bottom that points to my NEW! status page. NEAT! This didn't take me several hours build.....",
    acknowledgement:
      'By clicking I accept, you acknowledge that you understand how this works and will check the statuspage before texting me that something is broken (jk you can still text me).',
    next: 'Next',
    back: 'Back',
    done: 'Got it',
    accept: 'I accept',
    dismiss: 'Dismiss service status introduction',
    progress: 'Step {step} of 2',
  }
);

interface StatusOnboardingProps {
  userId?: number;
  revision: number;
}

const StatusOnboarding = ({ userId, revision }: StatusOnboardingProps) => {
  const intl = useIntl();
  const touchStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!userId) {
      return;
    }

    try {
      setIsVisible(
        !isStatusOnboardingDismissed(window.localStorage, userId, revision)
      );
    } catch {
      setIsVisible(true);
    }
  }, [revision, userId]);

  if (!isVisible || !userId) {
    return null;
  }

  const dismiss = () => {
    try {
      dismissStatusOnboarding(window.localStorage, userId, revision);
    } catch {
      // Keep the dismissal in memory when browser storage is unavailable.
    }
    setIsVisible(false);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStart.current = touch
      ? { x: touch.clientX, y: touch.clientY }
      : undefined;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = undefined;

    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0 && step === 1) {
      setStep(2);
    } else if (deltaX > 0 && step === 2) {
      setStep(1);
    }
  };

  return (
    <div
      className="absolute -right-1.5 top-full z-50 mt-3 w-72 max-w-[calc(100vw-1rem)] touch-pan-y rounded-lg border border-indigo-500/40 bg-gray-800/95 p-3 text-left shadow-xl backdrop-blur sm:-right-0.5"
      role="dialog"
      aria-labelledby="status-onboarding-title"
      data-testid="status-onboarding"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <span
        className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-indigo-500/40 bg-gray-800"
        aria-hidden="true"
      />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p
            id="status-onboarding-title"
            className="text-sm font-semibold text-white"
          >
            {intl.formatMessage(
              step === 3 ? messages.acknowledgementTitle : messages.title
            )}
          </p>
          <p className="mt-2 text-xs leading-5 text-gray-300">
            {intl.formatMessage(
              step === 1
                ? messages.statusColors
                : step === 2
                  ? messages.openMenu
                  : messages.acknowledgement
            )}
          </p>
        </div>
        {step === 2 && (
          <button
            type="button"
            onClick={dismiss}
            aria-label={intl.formatMessage(messages.dismiss)}
            className="-mr-1 -mt-1 rounded p-1 text-gray-400 transition hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-gray-700 pt-3">
        {step < 3 ? (
          <span className="flex items-center gap-0.5 text-xs text-gray-500">
            {step === 2 && (
              <ChevronLeftIcon
                className="h-3 w-3 text-gray-600"
                aria-hidden="true"
              />
            )}
            {intl.formatMessage(messages.progress, { step })}
            {step === 1 && (
              <ChevronRightIcon
                className="h-3 w-3 text-gray-600"
                aria-hidden="true"
              />
            )}
          </span>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded px-2.5 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {intl.formatMessage(messages.back)}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              step === 1 ? setStep(2) : step === 2 ? setStep(3) : dismiss()
            }
            className={`rounded px-2.5 py-1.5 text-xs font-medium text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${
              step === 1
                ? 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-400'
                : step === 2
                  ? 'bg-green-600 hover:bg-green-500 focus:ring-green-400'
                  : 'bg-red-600 hover:bg-red-500 focus:ring-red-400'
            }`}
          >
            {intl.formatMessage(
              step === 1
                ? messages.next
                : step === 2
                  ? messages.done
                  : messages.accept
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusOnboarding;
