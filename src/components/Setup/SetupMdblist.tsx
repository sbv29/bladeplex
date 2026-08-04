import Spinner from '@app/assets/spinner.svg';
import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import defineMessages from '@app/utils/defineMessages';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Setup.SetupMdblist', {
  title: 'Connect MDBList',
  description:
    'MDBList powers custom Discover lists and IMDb scores throughout Seerr.',
  apiKey: 'MDBList API Key',
  apiKeyHelp:
    'Create or sign in to your MDBList account, then copy your API key from Preferences.',
  openPreferences: 'Open MDBList Preferences',
  validate: 'Validate & Save',
  validating: 'Validating…',
  valid: 'MDBList is connected.',
  invalid: 'The API key could not be validated. Check the key and try again.',
  scanTitle: 'Initial IMDb Ratings Scan',
  scanDescription:
    'Scan your enabled libraries and cache their IMDb ratings. You can continue while this runs in the background.',
  runScan: 'Run Initial Scan',
  libraryStage: 'Scanning libraries',
  ratingsStage: 'Caching IMDb ratings',
  scanComplete: 'Initial ratings scan complete.',
  scanFailed: 'The initial scan encountered an error.',
  back: 'Back',
  continue: 'Continue',
  skip: 'Skip MDBList',
  skipTitle: 'Continue without MDBList?',
  skipWarning:
    'Custom MDBList discovery lists and IMDb scores will not function without an API key. You can configure MDBList later in General Settings.',
  skipAnyway: 'Skip Anyway',
  cancel: 'Cancel',
});

interface InitialScanStatus {
  running: boolean;
  stage: 'idle' | 'library' | 'ratings' | 'complete' | 'error';
  error?: string;
  library: { progress: number; total: number };
  ratings: {
    progress: number;
    total: number;
    requests: number;
    successes: number;
    missing: number;
    failures: number;
  };
}

interface SetupMdblistProps {
  onBack: () => void;
  onContinue: (configured: boolean) => void;
}

const SetupMdblist = ({ onBack, onContinue }: SetupMdblistProps) => {
  const intl = useIntl();
  const [apiKey, setApiKey] = useState('');
  const [validating, setValidating] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const { data: mainSettings } = useSWR<{ mdblistApiKey?: string }>(
    '/api/v1/settings/main'
  );
  const { data: scan, mutate } = useSWR<InitialScanStatus>(
    configured ? '/api/v1/settings/imdb-ratings/initial-scan' : null,
    { refreshInterval: (data) => (data?.running ? 1000 : 0) }
  );

  useEffect(() => {
    if (mainSettings?.mdblistApiKey) setConfigured(true);
  }, [mainSettings?.mdblistApiKey]);

  const validate = async () => {
    setValidating(true);
    setValidationError('');
    try {
      await axios.post('/api/v1/settings/main/mdblist/validate', { apiKey });
      setConfigured(true);
      setApiKey('');
    } catch (error) {
      const responseMessage = axios.isAxiosError(error)
        ? error.response?.data?.message
        : undefined;
      const responseStatus = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      setValidationError(
        responseMessage
          ? `${responseMessage}${responseStatus ? ` (HTTP ${responseStatus})` : ''}`
          : intl.formatMessage(messages.invalid)
      );
    } finally {
      setValidating(false);
    }
  };

  const startScan = async () => {
    const response = await axios.post<InitialScanStatus>(
      '/api/v1/settings/imdb-ratings/initial-scan'
    );
    await mutate(response.data, false);
  };

  const activeProgress =
    scan?.stage === 'library' ? scan.library : scan?.ratings;
  const progressPercent = activeProgress?.total
    ? Math.min(100, (activeProgress.progress / activeProgress.total) * 100)
    : 0;

  return (
    <div className="p-2">
      {showSkipWarning && (
        <div className="mb-6 rounded-lg bg-gray-800 p-5 ring-1 ring-yellow-500/60">
          <h4 className="mb-3 text-lg font-semibold text-white">
            {intl.formatMessage(messages.skipTitle)}
          </h4>
          <Alert type="warning">
            {intl.formatMessage(messages.skipWarning)}
          </Alert>
          <div className="mt-4 flex justify-end gap-3">
            <Button
              buttonType="default"
              onClick={() => setShowSkipWarning(false)}
            >
              {intl.formatMessage(messages.cancel)}
            </Button>
            <Button buttonType="warning" onClick={() => onContinue(false)}>
              {intl.formatMessage(messages.skipAnyway)}
            </Button>
          </div>
        </div>
      )}

      <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
      <p className="description">{intl.formatMessage(messages.description)}</p>

      {!configured ? (
        <div className="mt-6 space-y-5 rounded-lg bg-gray-800 p-5 ring-1 ring-gray-700">
          <div>
            <label htmlFor="setupMdblistApiKey" className="text-label">
              {intl.formatMessage(messages.apiKey)}
            </label>
            <div className="mt-2 flex w-full rounded-md shadow-sm">
              <SensitiveInput
                id="setupMdblistApiKey"
                type="text"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setValidationError('');
                }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-400">
              {intl.formatMessage(messages.apiKeyHelp)}{' '}
              <a
                className="text-indigo-400 hover:text-indigo-300"
                href="https://mdblist.com/preferences/"
                target="_blank"
                rel="noreferrer"
              >
                {intl.formatMessage(messages.openPreferences)}
              </a>
            </p>
          </div>
          {validationError && <Alert type="error">{validationError}</Alert>}
          <div className="flex justify-end">
            <Button
              buttonType="primary"
              disabled={!apiKey.trim() || validating}
              onClick={validate}
            >
              {validating && <Spinner className="mr-2 h-5 w-5" />}
              <span>
                {intl.formatMessage(
                  validating ? messages.validating : messages.validate
                )}
              </span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <div className="rounded-md border border-green-600/60 bg-green-900/20 p-4 text-green-300">
            <span className="flex items-center gap-2 text-sm">
              <CheckCircleIcon className="h-5 w-5" />
              {intl.formatMessage(messages.valid)}
            </span>
          </div>
          <div className="mt-5 rounded-lg bg-gray-800 p-5 ring-1 ring-gray-700">
            <h4 className="text-lg font-semibold text-white">
              {intl.formatMessage(messages.scanTitle)}
            </h4>
            <p className="mt-1 text-sm text-gray-400">
              {intl.formatMessage(messages.scanDescription)}
            </p>
            {scan?.running && (
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-sm text-gray-300">
                  <span>
                    {intl.formatMessage(
                      scan.stage === 'library'
                        ? messages.libraryStage
                        : messages.ratingsStage
                    )}
                  </span>
                  <span>
                    {activeProgress?.progress ?? 0}/{activeProgress?.total ?? 0}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-gray-700">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {scan.stage === 'ratings' && (
                  <p className="mt-2 text-xs text-gray-400">
                    {scan.ratings.requests} requests · {scan.ratings.successes}{' '}
                    updated · {scan.ratings.missing} missing ·{' '}
                    {scan.ratings.failures} failed
                  </p>
                )}
              </div>
            )}
            {scan?.stage === 'complete' && (
              <div className="mt-5 rounded-md border border-green-600/60 bg-green-900/20 p-4 text-sm text-green-300">
                {intl.formatMessage(messages.scanComplete)}
              </div>
            )}
            {scan?.stage === 'error' && (
              <Alert type="error">
                {scan.error || intl.formatMessage(messages.scanFailed)}
              </Alert>
            )}
            {!scan?.running && scan?.stage !== 'complete' && (
              <div className="mt-5">
                <Button buttonType="primary" onClick={startScan}>
                  {intl.formatMessage(messages.runScan)}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="actions mt-6">
        <div className="flex justify-between">
          <Button buttonType="default" onClick={onBack}>
            {intl.formatMessage(messages.back)}
          </Button>
          <div className="flex gap-3">
            {!configured && (
              <Button
                buttonType="warning"
                onClick={() => setShowSkipWarning(true)}
              >
                {intl.formatMessage(messages.skip)}
              </Button>
            )}
            {configured && (
              <Button buttonType="primary" onClick={() => onContinue(true)}>
                {intl.formatMessage(messages.continue)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupMdblist;
