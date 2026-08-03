import type { AllSettings } from '@server/lib/settings';

const MIGRATION_NAME = '0009_rebrand_application_title';

const rebrandApplicationTitle = (settings: AllSettings): AllSettings => {
  if (
    Array.isArray(settings.migrations) &&
    settings.migrations.includes(MIGRATION_NAME)
  ) {
    return settings;
  }

  if (settings.main.applicationTitle === 'Seerr') {
    settings.main.applicationTitle = 'BladePlex';
  }

  if (!Array.isArray(settings.migrations)) {
    settings.migrations = [];
  }
  settings.migrations.push(MIGRATION_NAME);

  return settings;
};

export default rebrandApplicationTitle;
