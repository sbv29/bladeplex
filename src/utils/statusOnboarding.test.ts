import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STATUS_ONBOARDING_REVISION,
  dismissStatusOnboarding,
  isStatusOnboardingDismissed,
} from './statusOnboarding';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe('status onboarding dismissal', () => {
  it('persists dismissal for the current revision and user', () => {
    const storage = createStorage();

    dismissStatusOnboarding(storage, 7);

    assert.equal(isStatusOnboardingDismissed(storage, 7), true);
    assert.equal(isStatusOnboardingDismissed(storage, 8), false);
  });

  it('shows the onboarding again when its revision changes', () => {
    const storage = createStorage();
    dismissStatusOnboarding(storage, 7);

    assert.equal(
      isStatusOnboardingDismissed(storage, 7, STATUS_ONBOARDING_REVISION + 1),
      false
    );
  });
});
