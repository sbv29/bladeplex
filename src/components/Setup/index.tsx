import EmbyLogo from '@app/assets/services/emby.svg';
import JellyfinLogo from '@app/assets/services/jellyfin.svg';
import PlexLogo from '@app/assets/services/plex.svg';
import AppDataWarning from '@app/components/AppDataWarning';
import Button from '@app/components/Common/Button';
import ImageFader from '@app/components/Common/ImageFader';
import PageTitle from '@app/components/Common/PageTitle';
import LanguagePicker from '@app/components/Layout/LanguagePicker';
import SettingsJellyfin from '@app/components/Settings/SettingsJellyfin';
import SettingsPlex from '@app/components/Settings/SettingsPlex';
import SettingsServices from '@app/components/Settings/SettingsServices';
import SetupSteps from '@app/components/Setup/SetupSteps';
import useLocale from '@app/hooks/useLocale';
import useSettings from '@app/hooks/useSettings';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import { MediaServerType } from '@server/constants/server';
import type { Library } from '@server/lib/settings';
import axios from 'axios';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { mutate } from 'swr';
import SetupLogin from './SetupLogin';
import SetupMdblist from './SetupMdblist';
import SetupMdblistItems from './SetupMdblistItems';

const messages = defineMessages('components.Setup', {
  welcome: 'Welcome to Seerr',
  subtitle: 'Get started by choosing your media server',
  configjellyfin: 'Configure Jellyfin',
  configplex: 'Configure Plex',
  configemby: 'Configure Emby',
  setup: 'Setup',
  back: 'Back',
  continue: 'Continue',
  servertype: 'Server Type',
  signin: 'Sign In',
  configuremediaserver: 'Media Server',
  configureservices: 'Services',
  configuremdblist: 'MDBList',
  configurelists: 'Lists',
  configurecollections: 'Collections',
  librarieserror:
    'Validation failed. Please toggle the libraries again to continue.',
});

const Setup = () => {
  const intl = useIntl();
  const [currentStep, setCurrentStep] = useState(1);
  const [mediaServerSettingsComplete, setMediaServerSettingsComplete] =
    useState(false);
  const [mediaServerType, setMediaServerType] = useState(
    MediaServerType.NOT_CONFIGURED
  );
  const [mdblistConfigured, setMdblistConfigured] = useState(false);
  const restoredConfiguredStep = useRef(false);
  const router = useRouter();
  const { locale } = useLocale();
  const settings = useSettings();
  const toasts = useToasts();

  const finishSetup = async () => {
    const response = await axios.post<{ initialized: boolean }>(
      '/api/v1/settings/initialize'
    );

    if (response.data.initialized) {
      await axios.post('/api/v1/settings/main', { locale });
      mutate('/api/v1/settings/public');

      router.push('/');
    }
  };

  const validateLibraries = useCallback(async () => {
    try {
      const endpointMap: Record<MediaServerType, string> = {
        [MediaServerType.JELLYFIN]: '/api/v1/settings/jellyfin',
        [MediaServerType.EMBY]: '/api/v1/settings/jellyfin',
        [MediaServerType.PLEX]: '/api/v1/settings/plex',
        [MediaServerType.NOT_CONFIGURED]: '',
      };

      const endpoint = endpointMap[mediaServerType];
      if (!endpoint) return;

      const response = await axios.get(endpoint);

      const hasEnabledLibraries = response.data?.libraries?.some(
        (library: Library) => library.enabled
      );

      setMediaServerSettingsComplete(hasEnabledLibraries);
    } catch {
      toasts.addToast(intl.formatMessage(messages.librarieserror), {
        autoDismiss: true,
        appearance: 'error',
      });

      setMediaServerSettingsComplete(false);
    }
  }, [intl, mediaServerType, toasts]);

  const { data: backdrops } = useSWR<string[]>('/api/v1/backdrops', {
    refreshInterval: 0,
    refreshWhenHidden: false,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (settings.currentSettings.initialized) {
      router.push('/');
    }

    if (
      !restoredConfiguredStep.current &&
      settings.currentSettings.mediaServerType !==
        MediaServerType.NOT_CONFIGURED
    ) {
      restoredConfiguredStep.current = true;
      setMediaServerType(settings.currentSettings.mediaServerType);
      if (currentStep < 3) {
        setCurrentStep(3);
      }
    }
  }, [
    settings.currentSettings.mediaServerType,
    settings.currentSettings.initialized,
    router,
    toasts,
    intl,
    currentStep,
    mediaServerType,
    validateLibraries,
  ]);

  useEffect(() => {
    if (currentStep === 3) {
      validateLibraries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const handleComplete = () => {
    validateLibraries();
  };

  if (settings.currentSettings.initialized) return <></>;

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-gray-900 py-12">
      <PageTitle title={intl.formatMessage(messages.setup)} />
      <ImageFader
        backgroundImages={
          backdrops?.map(
            (backdrop) => `https://image.tmdb.org/t/p/original${backdrop}`
          ) ?? []
        }
      />
      <div className="absolute right-4 top-4 z-50">
        <LanguagePicker />
      </div>
      <div className="relative z-40 px-4 sm:mx-auto sm:w-full sm:max-w-4xl">
        <div className="relative mb-10 h-48 max-w-full sm:mx-auto sm:h-64 sm:max-w-md">
          <Image
            src="/BLADE30.svg"
            alt="Logo"
            className="object-contain"
            fill
          />
        </div>
        <AppDataWarning />
        <nav className="relative z-50">
          <ul
            className="divide-y divide-gray-600 rounded-md border border-gray-600 bg-gray-800/50 md:grid md:grid-cols-7 md:divide-y-0"
            style={{ backdropFilter: 'blur(5px)' }}
          >
            <SetupSteps
              stepNumber={1}
              description={intl.formatMessage(messages.servertype)}
              active={currentStep === 1}
              completed={currentStep > 1}
            />
            <SetupSteps
              stepNumber={2}
              description={intl.formatMessage(messages.signin)}
              active={currentStep === 2}
              completed={currentStep > 2}
            />
            <SetupSteps
              stepNumber={3}
              description={intl.formatMessage(messages.configuremediaserver)}
              active={currentStep === 3}
              completed={currentStep > 3}
            />
            <SetupSteps
              stepNumber={4}
              description={intl.formatMessage(messages.configureservices)}
              active={currentStep === 4}
              completed={currentStep > 4}
            />
            <SetupSteps
              stepNumber={5}
              description={intl.formatMessage(messages.configuremdblist)}
              active={currentStep === 5}
              completed={currentStep > 5}
            />
            <SetupSteps
              stepNumber={6}
              description={intl.formatMessage(messages.configurelists)}
              active={currentStep === 6}
              completed={currentStep > 6}
            />
            <SetupSteps
              stepNumber={7}
              description={intl.formatMessage(messages.configurecollections)}
              active={currentStep === 7}
              isLastStep
            />
          </ul>
        </nav>
        <div className="mt-10 w-full rounded-md border border-gray-600 bg-gray-800/50 p-4 text-white">
          {currentStep === 1 && (
            <div className="flex flex-col items-center pb-6">
              <div className="mb-2 flex justify-center text-xl font-bold">
                {intl.formatMessage(messages.welcome)}
              </div>
              <div className="mb-2 flex justify-center pb-6 text-sm">
                {intl.formatMessage(messages.subtitle)}
              </div>
              <div className="grid w-full grid-cols-1 sm:w-auto sm:grid-cols-3">
                <div className="flex flex-col divide-y divide-gray-600 rounded-l border border-gray-600 py-2">
                  <div className="mb-2 flex flex-1 items-center justify-center px-2 py-2">
                    <JellyfinLogo className="h-10" />
                  </div>
                  <div className="px-2 pt-2">
                    <button
                      onClick={() => {
                        setMediaServerType(MediaServerType.JELLYFIN);
                      }}
                      className={`button-md relative z-10 inline-flex h-full w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium leading-5 text-white transition duration-150 ease-in-out hover:z-20 hover:border-gray-200 focus:z-20 focus:border-gray-100 focus:outline-none active:border-gray-100 ${
                        mediaServerType === MediaServerType.JELLYFIN
                          ? 'border-indigo-500 bg-indigo-600/30'
                          : 'border-gray-600 bg-transparent'
                      }`}
                    >
                      {intl.formatMessage(messages.configjellyfin)}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col divide-y divide-gray-600 border-y border-gray-600 py-2">
                  <div className="mb-2 flex flex-1 items-center justify-center px-2 py-2">
                    <PlexLogo className="h-8" />
                  </div>
                  <div className="px-2 pt-2">
                    <button
                      onClick={() => {
                        setMediaServerType(MediaServerType.PLEX);
                      }}
                      className={`button-md relative z-10 inline-flex h-full w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium leading-5 text-white transition duration-150 ease-in-out hover:z-20 hover:border-gray-200 focus:z-20 focus:border-gray-100 focus:outline-none active:border-gray-100 ${
                        mediaServerType === MediaServerType.PLEX
                          ? 'border-indigo-500 bg-indigo-600/30'
                          : 'border-gray-600 bg-transparent'
                      }`}
                    >
                      {intl.formatMessage(messages.configplex)}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col divide-y divide-gray-600 rounded-r border border-gray-600 py-2">
                  <div className="mb-2 flex flex-1 items-center justify-center px-2 py-2">
                    <EmbyLogo className="h-9" />
                  </div>
                  <div className="px-2 pt-2">
                    <button
                      onClick={() => {
                        setMediaServerType(MediaServerType.EMBY);
                      }}
                      className={`button-md relative z-10 inline-flex h-full w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium leading-5 text-white transition duration-150 ease-in-out hover:z-20 hover:border-gray-200 focus:z-20 focus:border-gray-100 focus:outline-none active:border-gray-100 ${
                        mediaServerType === MediaServerType.EMBY
                          ? 'border-indigo-500 bg-indigo-600/30'
                          : 'border-gray-600 bg-transparent'
                      }`}
                    >
                      {intl.formatMessage(messages.configemby)}
                    </button>
                  </div>
                </div>
              </div>
              <div className="actions w-full">
                <div className="flex justify-end">
                  <Button
                    buttonType="primary"
                    disabled={
                      mediaServerType === MediaServerType.NOT_CONFIGURED
                    }
                    onClick={() => setCurrentStep(2)}
                  >
                    {intl.formatMessage(messages.continue)}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {currentStep === 2 && (
            <SetupLogin
              serverType={mediaServerType}
              onCancel={() => {
                setMediaServerType(MediaServerType.NOT_CONFIGURED);
                setCurrentStep(1);
              }}
              onComplete={() => setCurrentStep(3)}
            />
          )}
          {currentStep === 3 && (
            <div className="p-2">
              {mediaServerType === MediaServerType.PLEX ? (
                <SettingsPlex onComplete={handleComplete} />
              ) : (
                <SettingsJellyfin isSetupSettings onComplete={handleComplete} />
              )}
              <div className="actions">
                <div className="flex justify-between gap-3">
                  <Button
                    buttonType="default"
                    onClick={() => setCurrentStep(2)}
                  >
                    {intl.formatMessage(messages.back)}
                  </Button>
                  <span className="inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      disabled={!mediaServerSettingsComplete}
                      onClick={() => setCurrentStep(4)}
                    >
                      {intl.formatMessage(messages.continue)}
                    </Button>
                  </span>
                </div>
              </div>
            </div>
          )}
          {currentStep === 4 && (
            <div>
              <SettingsServices />
              <div className="actions">
                <div className="flex justify-between gap-3">
                  <Button
                    buttonType="default"
                    onClick={() => setCurrentStep(3)}
                  >
                    {intl.formatMessage(messages.back)}
                  </Button>
                  <span className="inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      onClick={() => setCurrentStep(5)}
                    >
                      {intl.formatMessage(messages.continue)}
                    </Button>
                  </span>
                </div>
              </div>
            </div>
          )}
          {currentStep === 5 && (
            <SetupMdblist
              onBack={() => setCurrentStep(4)}
              onContinue={(configured) => {
                setMdblistConfigured(configured);
                setCurrentStep(6);
              }}
            />
          )}
          {currentStep === 6 && (
            <SetupMdblistItems
              key="custom-lists"
              type="list"
              configured={mdblistConfigured}
              onBack={() => setCurrentStep(5)}
              onContinue={() => setCurrentStep(7)}
            />
          )}
          {currentStep === 7 && (
            <SetupMdblistItems
              key="custom-collections"
              type="collection"
              configured={mdblistConfigured}
              finalStep
              onBack={() => setCurrentStep(6)}
              onContinue={finishSetup}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Setup;
