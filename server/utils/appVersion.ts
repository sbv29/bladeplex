import logger from '@server/logger';
import { existsSync, readFileSync } from 'fs';
import { load } from 'js-yaml';
import path from 'path';

const COMMIT_TAG_PATH = path.join(__dirname, '../../committag.json');
const DOCKER_MARKER_PATH = path.join(__dirname, '../../config/DOCKER');
const UPSTREAM_CHART_PATH = path.join(
  __dirname,
  '../../charts/seerr-chart/Chart.yaml'
);
let commitTag = 'local';

if (existsSync(COMMIT_TAG_PATH)) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  commitTag = require(COMMIT_TAG_PATH).commitTag;
  logger.info(`Commit Tag: ${commitTag}`);
}

export const getCommitTag = (): string => {
  return commitTag;
};

export const getBladePlexVersion = (): string => {
  return getCommitTag().replace(/^develop-/, '');
};

export const getBuildCommit = (): string => {
  return getBladePlexVersion().split('-', 1)[0];
};

export const getBuildBranch = (): string => {
  const version = getBladePlexVersion();
  const separatorIndex = version.indexOf('-');

  return separatorIndex === -1 ? 'unknown' : version.slice(separatorIndex + 1);
};

export const getDeploymentType = (): 'docker' | 'local' => {
  return existsSync(DOCKER_MARKER_PATH) ? 'docker' : 'local';
};

export const getUpstreamVersion = (): string | undefined => {
  try {
    const chart = load(readFileSync(UPSTREAM_CHART_PATH, 'utf8')) as {
      appVersion?: unknown;
    };

    return typeof chart.appVersion === 'string' ? chart.appVersion : undefined;
  } catch (error) {
    logger.warn('Unable to determine the upstream Seerr version.', {
      label: 'App Version',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
};

export const getAppVersion = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { version } = require('../../package.json');

  let finalVersion = version;

  if (version === '0.1.0') {
    finalVersion = `develop-${getCommitTag()}`;
  }

  return finalVersion;
};
