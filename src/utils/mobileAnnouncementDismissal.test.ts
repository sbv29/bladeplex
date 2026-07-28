import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MOBILE_ANNOUNCEMENT_DISMISSED_REVISION_KEY,
  dismissMobileAnnouncement,
  isMobileAnnouncementDismissed,
} from './mobileAnnouncementDismissal';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe('mobile announcement dismissal', () => {
  it('persists dismissal for the same revision', () => {
    const storage = createStorage();

    dismissMobileAnnouncement(storage, 3);

    assert.equal(
      storage.getItem(MOBILE_ANNOUNCEMENT_DISMISSED_REVISION_KEY),
      '3'
    );
    assert.equal(isMobileAnnouncementDismissed(storage, 3), true);
  });

  it('shows the announcement when the revision changes', () => {
    const storage = createStorage();
    dismissMobileAnnouncement(storage, 3);

    assert.equal(isMobileAnnouncementDismissed(storage, 4), false);
  });
});
