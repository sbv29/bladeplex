import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AllSettings } from '@server/lib/settings';
import rebrandApplicationTitle from '@server/lib/settings/migrations/0009_rebrand_application_title';

const settingsWithTitle = (applicationTitle: string) =>
  ({
    main: { applicationTitle },
    migrations: [],
  }) as unknown as AllSettings;

describe('rebrand application title migration', () => {
  it('changes the inherited Seerr title to BladePlex', () => {
    const settings = rebrandApplicationTitle(settingsWithTitle('Seerr'));

    assert.equal(settings.main.applicationTitle, 'BladePlex');
    assert.ok(settings.migrations.includes('0009_rebrand_application_title'));
  });

  it('preserves a customized application title', () => {
    const settings = rebrandApplicationTitle(settingsWithTitle('My Media'));

    assert.equal(settings.main.applicationTitle, 'My Media');
  });

  it('is idempotent', () => {
    const settings = settingsWithTitle('Seerr');
    settings.migrations.push('0009_rebrand_application_title');

    assert.equal(
      rebrandApplicationTitle(settings).main.applicationTitle,
      'Seerr'
    );
  });
});
