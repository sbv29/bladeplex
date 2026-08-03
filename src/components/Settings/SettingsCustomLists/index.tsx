import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import PageTitle from '@app/components/Common/PageTitle';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { Fragment, useState, type FormEvent } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { mutate as globalMutate } from 'swr';

const messages = defineMessages('components.Settings.SettingsCustomLists', {
  title: 'Custom Lists',
  description:
    'Add public or official MDBList movie and show lists as native Discover sliders with full-page views.',
  apiKeyRequired: 'Configure an MDBList API key in General settings first.',
  url: 'MDBList URL',
  urlPlaceholder: 'https://mdblist.com/lists/user/list-name',
  displayTitle: 'Display Title (Optional)',
  displayTitlePlaceholder: 'Uses the MDBList title when left blank',
  validate: 'Validate List',
  validating: 'Validating…',
  add: 'Add to Discover',
  adding: 'Adding…',
  preview: 'List Preview',
  itemCount:
    '{count, plural, one {# item} other {# items}} reported by MDBList',
  noLists: 'No custom lists have been added yet.',
  enabled: 'Visible',
  disabled: 'Hidden',
  official: 'Official',
  public: 'Public',
  delete: 'Delete List',
  deleteTitle: 'Delete Custom List',
  deleteConfirm:
    'Are you sure you want to delete “{title}”? This will remove its homepage slider and full-page view.',
  deleteButtonLabel: 'Delete {title}',
  added: 'Custom list added to Discover.',
  deleted: 'Custom list removed.',
  validationFailed: 'Unable to validate this MDBList list.',
  addFailed: 'Unable to add this custom list.',
  deleteFailed: 'Unable to remove this custom list.',
  customizeHint:
    'Use Customize Discover on the main page to reorder or hide these sliders.',
});

interface CustomListItem {
  id: number;
  title: string;
  sourceUrl: string;
  listType: 'official' | 'public';
  itemCount: number;
  mediaType: 'movie' | 'tv';
  discoverSlider: {
    id: number;
    enabled: boolean;
    order: number;
  } | null;
}

interface CustomListsResponse {
  mdblistConfigured: boolean;
  items: CustomListItem[];
}

interface ListPreview {
  canonicalUrl: string;
  listType: 'official' | 'public';
  title: string;
  providerTitle: string;
  itemCount: number;
  mediaType: 'movie' | 'tv';
  preview: {
    rank: number;
    title: string;
    year?: number | null;
    tmdbId?: number | null;
  }[];
}

const SettingsCustomLists = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { data, error, mutate } = useSWR<CustomListsResponse>(
    '/api/v1/settings/custom-lists'
  );
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<ListPreview | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [listPendingDelete, setListPendingDelete] =
    useState<CustomListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getErrorMessage = (requestError: unknown, fallback: string) =>
    axios.isAxiosError(requestError) &&
    typeof requestError.response?.data?.message === 'string'
      ? requestError.response.data.message
      : fallback;

  const validate = async (event: FormEvent) => {
    event.preventDefault();
    setIsValidating(true);
    setPreview(null);
    try {
      const response = await axios.post<ListPreview>(
        '/api/v1/settings/custom-lists/validate',
        { url, ...(title.trim() ? { title } : {}) }
      );
      setPreview(response.data);
    } catch (requestError) {
      addToast(
        getErrorMessage(
          requestError,
          intl.formatMessage(messages.validationFailed)
        ),
        { appearance: 'error', autoDismiss: true }
      );
    } finally {
      setIsValidating(false);
    }
  };

  const addList = async () => {
    setIsAdding(true);
    try {
      await axios.post('/api/v1/settings/custom-lists', {
        url,
        ...(title.trim() ? { title } : {}),
      });
      setUrl('');
      setTitle('');
      setPreview(null);
      await mutate();
      await globalMutate('/api/v1/settings/discover');
      addToast(intl.formatMessage(messages.added), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (requestError) {
      addToast(
        getErrorMessage(requestError, intl.formatMessage(messages.addFailed)),
        { appearance: 'error', autoDismiss: true }
      );
    } finally {
      setIsAdding(false);
    }
  };

  const deleteList = async (listId: number): Promise<boolean> => {
    try {
      await axios.delete(`/api/v1/settings/custom-lists/${listId}`);
      await mutate();
      await globalMutate('/api/v1/settings/discover');
      addToast(intl.formatMessage(messages.deleted), {
        appearance: 'success',
        autoDismiss: true,
      });
      return true;
    } catch (requestError) {
      addToast(
        getErrorMessage(
          requestError,
          intl.formatMessage(messages.deleteFailed)
        ),
        { appearance: 'error', autoDismiss: true }
      );
      return false;
    }
  };

  const confirmDelete = async () => {
    if (!listPendingDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    const deleted = await deleteList(listPendingDelete.id);
    setIsDeleting(false);
    if (deleted) {
      setListPendingDelete(null);
    }
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Transition
        as={Fragment}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={Boolean(listPendingDelete)}
      >
        <Modal
          title={intl.formatMessage(messages.deleteTitle)}
          onCancel={() => {
            if (!isDeleting) {
              setListPendingDelete(null);
            }
          }}
          onOk={confirmDelete}
          cancelButtonProps={{ disabled: isDeleting }}
          okDisabled={isDeleting}
          okText={intl.formatMessage(messages.delete)}
          okButtonType="danger"
          backgroundClickable={!isDeleting}
          dialogClass="sm:max-w-lg"
        >
          {listPendingDelete &&
            intl.formatMessage(messages.deleteConfirm, {
              title: listPendingDelete.title,
            })}
        </Modal>
      </Transition>
      <PageTitle title={intl.formatMessage(messages.title)} />
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
        <p className="description">
          {intl.formatMessage(messages.description)}
        </p>
      </div>

      {!data?.mdblistConfigured && (
        <Alert type="warning">
          {intl.formatMessage(messages.apiKeyRequired)}
        </Alert>
      )}

      <form
        className="mb-8 rounded-lg bg-gray-800 p-6 ring-1 ring-gray-700"
        onSubmit={validate}
      >
        <div className="space-y-5">
          <div className="form-row">
            <label htmlFor="customListUrl" className="text-label">
              {intl.formatMessage(messages.url)}
            </label>
            <div className="form-input-area">
              <input
                id="customListUrl"
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                maxLength={500}
                value={url}
                placeholder={intl.formatMessage(messages.urlPlaceholder)}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setPreview(null);
                }}
              />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="customListTitle" className="text-label">
              {intl.formatMessage(messages.displayTitle)}
            </label>
            <div className="form-input-area">
              <input
                id="customListTitle"
                type="text"
                maxLength={100}
                value={title}
                placeholder={intl.formatMessage(
                  messages.displayTitlePlaceholder
                )}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setPreview(null);
                }}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              buttonType="primary"
              disabled={!data?.mdblistConfigured || isValidating || !url.trim()}
            >
              <ArrowPathIcon className={isValidating ? 'animate-spin' : ''} />
              <span>
                {intl.formatMessage(
                  isValidating ? messages.validating : messages.validate
                )}
              </span>
            </Button>
          </div>
        </div>
      </form>

      {preview && (
        <div className="mb-8 rounded-lg border border-green-600/60 bg-green-900/20 p-5">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircleIcon className="h-6 w-6 text-green-400" />
            <h4 className="text-lg font-semibold text-white">
              {intl.formatMessage(messages.preview)}: {preview.title}
            </h4>
          </div>
          <p className="mb-3 text-sm text-gray-300">
            {intl.formatMessage(messages.itemCount, {
              count: preview.itemCount,
            })}
          </p>
          <ol className="mb-4 list-inside list-decimal space-y-1 text-sm text-gray-300">
            {preview.preview.map((movie) => (
              <li key={`${movie.rank}-${movie.tmdbId ?? movie.title}`}>
                {movie.title}
                {movie.year ? ` (${movie.year})` : ''}
              </li>
            ))}
          </ol>
          <div className="flex justify-end">
            <Button buttonType="success" onClick={addList} disabled={isAdding}>
              <PlusIcon />
              <span>
                {intl.formatMessage(isAdding ? messages.adding : messages.add)}
              </span>
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h4 className="text-xl font-semibold text-white">
            {intl.formatMessage(messages.title)}
          </h4>
          <p className="mt-1 text-sm text-gray-400">
            {intl.formatMessage(messages.customizeHint)}
          </p>
        </div>
      </div>

      {data?.items.length ? (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.items.map((list) => (
            <li
              key={list.id}
              className="rounded-lg bg-gray-800 p-5 shadow ring-1 ring-gray-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h5 className="truncate font-semibold text-white">
                      {list.title}
                    </h5>
                    <Badge>
                      {intl.formatMessage(
                        list.listType === 'official'
                          ? messages.official
                          : messages.public
                      )}
                    </Badge>
                    <Badge
                      badgeType={
                        list.discoverSlider?.enabled ? 'success' : 'warning'
                      }
                    >
                      {intl.formatMessage(
                        list.discoverSlider?.enabled
                          ? messages.enabled
                          : messages.disabled
                      )}
                    </Badge>
                  </div>
                  <a
                    href={list.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm text-indigo-300 hover:underline"
                  >
                    {list.sourceUrl}
                  </a>
                  <p className="mt-2 text-sm text-gray-400">
                    {intl.formatMessage(messages.itemCount, {
                      count: list.itemCount,
                    })}
                  </p>
                </div>
                <Button
                  buttonType="danger"
                  aria-label={intl.formatMessage(messages.deleteButtonLabel, {
                    title: list.title,
                  })}
                  title={intl.formatMessage(messages.deleteButtonLabel, {
                    title: list.title,
                  })}
                  onClick={() => setListPendingDelete(list)}
                >
                  <TrashIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg bg-gray-800 p-8 text-center text-gray-400 ring-1 ring-gray-700">
          {intl.formatMessage(messages.noLists)}
        </div>
      )}
    </>
  );
};

export default SettingsCustomLists;
