export const MOBILE_ANNOUNCEMENT_DISMISSED_REVISION_KEY =
  'seerr.mobileAnnouncementDismissedRevision';

export const isMobileAnnouncementDismissed = (
  storage: Pick<Storage, 'getItem'>,
  revision: number
): boolean => {
  const savedRevision = storage.getItem(
    MOBILE_ANNOUNCEMENT_DISMISSED_REVISION_KEY
  );

  return savedRevision === String(revision);
};

export const dismissMobileAnnouncement = (
  storage: Pick<Storage, 'setItem'>,
  revision: number
): void => {
  storage.setItem(MOBILE_ANNOUNCEMENT_DISMISSED_REVISION_KEY, String(revision));
};
