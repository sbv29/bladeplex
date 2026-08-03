import type { AllSettings } from '@server/lib/settings';

const MIGRATION_NAME = '0010_weekly_imdb_rating_refresh';

const weeklyImdbRatingRefresh = (settings: AllSettings): AllSettings => {
  if (settings.migrations?.includes(MIGRATION_NAME)) return settings;

  if (
    settings.jobs?.['imdb-ratings-cache-refresh']?.schedule === '0 30 3 * * *'
  ) {
    settings.jobs['imdb-ratings-cache-refresh'].schedule = '0 30 3 * * 0';
  }

  settings.migrations ??= [];
  settings.migrations.push(MIGRATION_NAME);
  return settings;
};

export default weeklyImdbRatingRefresh;
