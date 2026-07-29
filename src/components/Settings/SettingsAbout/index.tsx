import Badge from '@app/components/Common/Badge';
import List from '@app/components/Common/List';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Releases from '@app/components/Settings/SettingsAbout/Releases';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { SettingsAboutResponse } from '@server/interfaces/api/settingsInterfaces';
import Image from 'next/image';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Settings.SettingsAbout', {
  about: 'About',
  aboutBladePlex: 'About BladePlex',
  bladePlexDescription:
    'BladePlex is a personalized media request and discovery experience built on Seerr.',
  bladePlexVersion: 'BladePlex Version',
  currentCommit: 'Current Commit',
  currentBranch: 'Current Branch',
  upstream: 'Upstream',
  basedOn: 'Based On',
  upstreamStatus: 'Upstream Status',
  upstreamLatest: 'Latest Seerr Release',
  upstreamUpToDate: '✓ Up to date',
  upstreamUpdateAvailable: 'Update available from Seerr',
  upstreamUnavailable: 'Unable to check Seerr releases',
  upstreamCheckDisabled: 'Upstream check disabled',
  upstreamVersionUnavailable: 'Seerr version unavailable',
  credits: 'Credits',
  bladePlex: 'BladePlex',
  bladePlexCredit: 'Created and maintained by Scott.',
  seerr: 'Seerr',
  seerrCredit: 'Created by the Seerr Team.',
  basedOnSeerr: 'BladePlex is based on Seerr.',
  links: 'Project Links',
  github: 'GitHub',
  documentation: 'Documentation',
  discord: 'Discord',
  donations: 'Donations',
  comingSoon: 'Coming Soon',
  technicalInformation: 'Technical Information',
  commitTag: 'Commit Tag',
  nodeVersion: 'Node Version',
  runtime: 'Runtime',
  docker: 'Docker',
  local: 'Local',
  database: 'Database',
  environment: 'Environment',
  totalmedia: 'Total Media',
  totalrequests: 'Total Requests',
  timezone: 'Time Zone',
  appDataPath: 'Data Directory',
});

const SettingsAbout = () => {
  const intl = useIntl();
  const { data, error } = useSWR<SettingsAboutResponse>(
    '/api/v1/settings/about'
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={500} />;
  }

  const upstreamStatus = {
    'up-to-date': (
      <Badge
        badgeType="success"
        href="https://github.com/seerr-team/seerr/releases"
      >
        {intl.formatMessage(messages.upstreamUpToDate)}
      </Badge>
    ),
    'update-available': (
      <Badge
        badgeType="warning"
        href="https://github.com/seerr-team/seerr/releases"
      >
        {intl.formatMessage(messages.upstreamUpdateAvailable)}
      </Badge>
    ),
    unavailable: (
      <Badge badgeType="light">
        {intl.formatMessage(messages.upstreamUnavailable)}
      </Badge>
    ),
    disabled: (
      <Badge badgeType="light">
        {intl.formatMessage(messages.upstreamCheckDisabled)}
      </Badge>
    ),
  }[data.upstreamStatus];

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.about),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="section">
        <div className="flex flex-col items-center gap-5 rounded-lg bg-gray-800/50 p-5 text-center shadow ring-1 ring-gray-700 sm:flex-row sm:text-left">
          <Image
            src="/BLADE30.svg"
            alt="BladePlex"
            width={96}
            height={96}
            className="h-24 w-24 flex-shrink-0 rounded-2xl"
          />
          <div>
            <h2 className="text-2xl font-bold text-white">
              {intl.formatMessage(messages.aboutBladePlex)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-300">
              {intl.formatMessage(messages.bladePlexDescription)}
            </p>
          </div>
        </div>
      </div>

      <div className="section">
        <List title={intl.formatMessage(messages.bladePlexVersion)}>
          <List.Item title={intl.formatMessage(messages.bladePlexVersion)}>
            <code className="text-base font-semibold">
              {data.bladeplexVersion}
            </code>
          </List.Item>
          <List.Item title={intl.formatMessage(messages.currentCommit)}>
            <code>{data.commit}</code>
          </List.Item>
          <List.Item title={intl.formatMessage(messages.currentBranch)}>
            <code>{data.branch}</code>
          </List.Item>
        </List>
      </div>

      <div className="section">
        <List title={intl.formatMessage(messages.upstream)}>
          <List.Item title={intl.formatMessage(messages.basedOn)}>
            {data.upstreamVersion ? (
              <a
                href="https://github.com/seerr-team/seerr"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 transition hover:underline"
              >
                Seerr {data.upstreamVersion}
              </a>
            ) : (
              intl.formatMessage(messages.upstreamVersionUnavailable)
            )}
          </List.Item>
          <List.Item title={intl.formatMessage(messages.upstreamStatus)}>
            {upstreamStatus}
          </List.Item>
          {data.latestUpstreamVersion && (
            <List.Item title={intl.formatMessage(messages.upstreamLatest)}>
              <code>{data.latestUpstreamVersion}</code>
            </List.Item>
          )}
        </List>
      </div>

      <div className="section">
        <List title={intl.formatMessage(messages.credits)}>
          <List.Item title={intl.formatMessage(messages.bladePlex)}>
            {intl.formatMessage(messages.bladePlexCredit)}
          </List.Item>
          <List.Item title={intl.formatMessage(messages.seerr)}>
            {intl.formatMessage(messages.seerrCredit)}
          </List.Item>
          <List.Item title={intl.formatMessage(messages.basedOn)}>
            <a
              href="https://github.com/seerr-team/seerr"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 transition hover:underline"
            >
              {intl.formatMessage(messages.basedOnSeerr)}
            </a>
          </List.Item>
        </List>
      </div>

      <div className="section">
        <List title={intl.formatMessage(messages.links)}>
          <List.Item title={intl.formatMessage(messages.github)}>
            <a
              href="https://github.com/sbv29/bladeplex"
              target="_blank"
              rel="noreferrer"
              className="break-all text-indigo-400 transition hover:underline"
            >
              https://github.com/sbv29/bladeplex
            </a>
          </List.Item>
          <List.Item title={intl.formatMessage(messages.documentation)}>
            <Badge badgeType="light">
              {intl.formatMessage(messages.comingSoon)}
            </Badge>
          </List.Item>
          <List.Item title={intl.formatMessage(messages.discord)}>
            <Badge badgeType="light">
              {intl.formatMessage(messages.comingSoon)}
            </Badge>
          </List.Item>
          <List.Item title={intl.formatMessage(messages.donations)}>
            <Badge badgeType="light">
              {intl.formatMessage(messages.comingSoon)}
            </Badge>
          </List.Item>
        </List>
      </div>

      <div className="section">
        <List title={intl.formatMessage(messages.technicalInformation)}>
          <List.Item title={intl.formatMessage(messages.commitTag)}>
            <code>{data.commitTag}</code>
          </List.Item>
          <List.Item title={intl.formatMessage(messages.nodeVersion)}>
            <code>{data.nodeVersion}</code>
          </List.Item>
          <List.Item title={intl.formatMessage(messages.runtime)}>
            {intl.formatMessage(
              data.deploymentType === 'docker'
                ? messages.docker
                : messages.local
            )}
          </List.Item>
          <List.Item title={intl.formatMessage(messages.database)}>
            <code>{data.databaseType}</code>
          </List.Item>
          <List.Item title={intl.formatMessage(messages.environment)}>
            <code>{data.environment}</code>
          </List.Item>
          <List.Item title={intl.formatMessage(messages.totalmedia)}>
            {intl.formatNumber(data.totalMediaItems)}
          </List.Item>
          <List.Item title={intl.formatMessage(messages.totalrequests)}>
            {intl.formatNumber(data.totalRequests)}
          </List.Item>
          <List.Item title={intl.formatMessage(messages.appDataPath)}>
            <code className="break-all">{data.appDataPath}</code>
          </List.Item>
          {data.tz && (
            <List.Item title={intl.formatMessage(messages.timezone)}>
              <code>{data.tz}</code>
            </List.Item>
          )}
        </List>
      </div>

      {data.upstreamVersion && (
        <div className="section">
          <Releases currentVersion={data.upstreamVersion} />
        </div>
      )}
    </>
  );
};

export default SettingsAbout;
