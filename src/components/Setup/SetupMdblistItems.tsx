import Spinner from '@app/assets/spinner.svg';
import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
import {
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Setup.SetupMdblistItems', {
  listTitle: 'Choose Custom Lists',
  listDescription:
    'Custom lists appear as standalone Discover sliders with full-page views. They are best for ranked or frequently updated feeds that users browse directly.',
  collectionTitle: 'Choose Custom Collections',
  collectionDescription:
    'Custom collections appear as tiles in the native Collections row. Opening a tile reveals its grouped titles, instead of adding another standalone Discover slider.',
  listUnavailable:
    'MDBList was skipped, so custom lists cannot be configured now. You can add an API key and lists later in Settings.',
  collectionUnavailable:
    'MDBList was skipped, so custom collections cannot be configured now. You can add an API key and collections later in Settings.',
  listUrl: 'MDBList List URL',
  collectionUrl: 'MDBList Collection URL',
  displayTitle: 'Display Title (optional)',
  collectionType: 'Collection Type',
  movies: 'Movies',
  tvShows: 'TV Shows',
  validate: 'Validate',
  validating: 'Validating…',
  valid: '{title} · {count} items',
  addList: 'Add Another List',
  addCollection: 'Add Another Collection',
  removeList: 'Remove list',
  removeCollection: 'Remove collection',
  saveFailed:
    'One or more entries could not be saved. Check the URLs and try again.',
  validationRequired:
    'Please validate every list or collection before proceeding.',
  back: 'Back',
  continue: 'Continue',
  finish: 'Finish Setup',
  saving: 'Saving…',
});

type SetupItemType = 'list' | 'collection';

interface ItemRow {
  id: number;
  url: string;
  title: string;
  mediaType: 'movie' | 'tv';
  validating?: boolean;
  preview?: { title: string; itemCount: number };
  error?: string;
}

const defaults: Record<SetupItemType, ItemRow> = {
  list: {
    id: 1,
    url: 'https://mdblist.com/lists/linaspurinis/top-watched-movies-of-the-week',
    title: 'Top Movies of the Week',
    mediaType: 'movie',
  },
  collection: {
    id: 1,
    url: 'https://mdblist.com/lists/hdlists/latest-hd-family-movies-top-rated-from-1980-to-today',
    title: 'Top Rated Family Movies',
    mediaType: 'movie',
  },
};

interface SetupMdblistItemsProps {
  type: SetupItemType;
  configured: boolean;
  finalStep?: boolean;
  onBack: () => void;
  onContinue: () => Promise<void> | void;
}

const SetupMdblistItems = ({
  type,
  configured,
  finalStep = false,
  onBack,
  onContinue,
}: SetupMdblistItemsProps) => {
  const intl = useIntl();
  const [rows, setRows] = useState<ItemRow[]>([{ ...defaults[type] }]);
  const [nextId, setNextId] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [validationRequired, setValidationRequired] = useState(false);
  const isCollection = type === 'collection';
  const endpoint = isCollection
    ? '/api/v1/settings/mdblist-collections'
    : '/api/v1/settings/custom-lists';

  const updateRow = (id: number, update: Partial<ItemRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...update } : row))
    );
  };

  const validate = async (row: ItemRow) => {
    setValidationRequired(false);
    updateRow(row.id, {
      validating: true,
      preview: undefined,
      error: undefined,
    });
    try {
      const response = await axios.post<{
        title?: string;
        displayTitle?: string;
        itemCount: number;
      }>(`${endpoint}/validate`, {
        url: row.url,
        ...(row.title.trim() ? { title: row.title.trim() } : {}),
        ...(isCollection ? { mediaType: row.mediaType } : {}),
      });
      updateRow(row.id, {
        validating: false,
        preview: {
          title: response.data.displayTitle ?? response.data.title ?? row.title,
          itemCount: response.data.itemCount,
        },
      });
    } catch (error) {
      updateRow(row.id, {
        validating: false,
        preview: undefined,
        error:
          axios.isAxiosError(error) &&
          typeof error.response?.data?.message === 'string'
            ? error.response.data.message
            : `Unable to validate this ${type}.`,
      });
    }
  };

  const save = async () => {
    if (configured && rows.some((row) => row.url.trim() && !row.preview)) {
      setValidationRequired(true);
      return;
    }

    setSaving(true);
    setSaveFailed(false);
    setValidationRequired(false);
    try {
      if (configured) {
        for (const row of rows.filter((item) => item.url.trim())) {
          try {
            await axios.post(endpoint, {
              url: row.url.trim(),
              ...(row.title.trim() ? { title: row.title.trim() } : {}),
              ...(isCollection ? { mediaType: row.mediaType } : {}),
            });
          } catch (error) {
            if (!axios.isAxiosError(error) || error.response?.status !== 409) {
              throw error;
            }
          }
        }
      }
      await onContinue();
    } catch {
      setSaveFailed(true);
      setSaving(false);
    }
  };

  return (
    <div className="p-2">
      <h3 className="heading">
        {intl.formatMessage(
          isCollection ? messages.collectionTitle : messages.listTitle
        )}
      </h3>
      <p className="description">
        {intl.formatMessage(
          isCollection
            ? messages.collectionDescription
            : messages.listDescription
        )}
      </p>

      {!configured ? (
        <div className="mt-6">
          <Alert type="warning">
            {intl.formatMessage(
              isCollection
                ? messages.collectionUnavailable
                : messages.listUnavailable
            )}
          </Alert>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="rounded-lg bg-gray-800 p-5 ring-1 ring-gray-700"
            >
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-semibold text-white">
                  {isCollection ? 'Collection' : 'List'} {index + 1}
                </h4>
                <button
                  type="button"
                  className="text-gray-400 hover:text-red-400"
                  aria-label={intl.formatMessage(
                    isCollection
                      ? messages.removeCollection
                      : messages.removeList
                  )}
                  onClick={() =>
                    setRows((current) =>
                      current.filter((item) => item.id !== row.id)
                    )
                  }
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor={`${type}Url-${row.id}`}
                    className="text-label"
                  >
                    {intl.formatMessage(
                      isCollection ? messages.collectionUrl : messages.listUrl
                    )}
                  </label>
                  <input
                    id={`${type}Url-${row.id}`}
                    className="mt-2"
                    type="url"
                    value={row.url}
                    onChange={(event) =>
                      updateRow(row.id, {
                        url: event.target.value,
                        preview: undefined,
                        error: undefined,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${type}Title-${row.id}`}
                    className="text-label"
                  >
                    {intl.formatMessage(messages.displayTitle)}
                  </label>
                  <input
                    id={`${type}Title-${row.id}`}
                    className="mt-2"
                    type="text"
                    maxLength={100}
                    value={row.title}
                    onChange={(event) =>
                      updateRow(row.id, {
                        title: event.target.value,
                        preview: undefined,
                        error: undefined,
                      })
                    }
                  />
                </div>
                {isCollection && (
                  <div>
                    <label
                      htmlFor={`${type}MediaType-${row.id}`}
                      className="text-label"
                    >
                      {intl.formatMessage(messages.collectionType)}
                    </label>
                    <select
                      id={`${type}MediaType-${row.id}`}
                      className="mt-2"
                      value={row.mediaType}
                      onChange={(event) =>
                        updateRow(row.id, {
                          mediaType: event.target.value as 'movie' | 'tv',
                          preview: undefined,
                          error: undefined,
                        })
                      }
                    >
                      <option value="movie">
                        {intl.formatMessage(messages.movies)}
                      </option>
                      <option value="tv">
                        {intl.formatMessage(messages.tvShows)}
                      </option>
                    </select>
                  </div>
                )}
                {row.preview && (
                  <p className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircleIcon className="h-5 w-5" />
                    {intl.formatMessage(messages.valid, {
                      title: row.preview.title,
                      count: row.preview.itemCount,
                    })}
                  </p>
                )}
                {row.error && <Alert type="error">{row.error}</Alert>}
                <div className="flex justify-end">
                  <Button
                    buttonType="success"
                    disabled={!row.url.trim() || row.validating}
                    onClick={() => validate(row)}
                  >
                    {row.validating && <Spinner className="mr-2 h-5 w-5" />}
                    <span>
                      {intl.formatMessage(
                        row.validating ? messages.validating : messages.validate
                      )}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button
            buttonType="default"
            onClick={() => {
              setRows((current) => [
                ...current,
                { id: nextId, url: '', title: '', mediaType: 'movie' },
              ]);
              setNextId((current) => current + 1);
            }}
          >
            <PlusIcon />
            <span>
              {intl.formatMessage(
                isCollection ? messages.addCollection : messages.addList
              )}
            </span>
          </Button>
        </div>
      )}

      {saveFailed && (
        <div className="mt-5">
          <Alert type="error">{intl.formatMessage(messages.saveFailed)}</Alert>
        </div>
      )}

      {validationRequired && (
        <div className="mt-5">
          <Alert type="warning">
            {intl.formatMessage(messages.validationRequired)}
          </Alert>
        </div>
      )}

      <div className="actions mt-6">
        <div className="flex justify-between gap-3">
          <Button buttonType="default" disabled={saving} onClick={onBack}>
            {intl.formatMessage(messages.back)}
          </Button>
          <Button buttonType="primary" disabled={saving} onClick={save}>
            {saving && <Spinner className="mr-2 h-5 w-5" />}
            <span>
              {intl.formatMessage(
                saving
                  ? messages.saving
                  : finalStep
                    ? messages.finish
                    : messages.continue
              )}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SetupMdblistItems;
