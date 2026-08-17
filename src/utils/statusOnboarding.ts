export const STATUS_ONBOARDING_REVISION = 1;
const STATUS_ONBOARDING_KEY_PREFIX = 'bladeplex.statusOnboardingRevision';

const getStatusOnboardingKey = (userId: number) =>
  `${STATUS_ONBOARDING_KEY_PREFIX}.${userId}`;

export const isStatusOnboardingDismissed = (
  storage: Pick<Storage, 'getItem'>,
  userId: number,
  revision = STATUS_ONBOARDING_REVISION
): boolean =>
  storage.getItem(getStatusOnboardingKey(userId)) === String(revision);

export const dismissStatusOnboarding = (
  storage: Pick<Storage, 'setItem'>,
  userId: number,
  revision = STATUS_ONBOARDING_REVISION
): void => {
  storage.setItem(getStatusOnboardingKey(userId), String(revision));
};
