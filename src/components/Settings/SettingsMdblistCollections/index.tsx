import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Modal from '@app/components/Common/Modal';
import PageTitle from '@app/components/Common/PageTitle';
import SlideCheckbox from '@app/components/Common/SlideCheckbox';
import useToasts from '@app/hooks/useToasts';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowsUpDownIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useEffect, useState, type FormEvent } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { mutate as globalMutate } from 'swr';

const messages = defineMessages(
  'components.Settings.SettingsMdblistCollections',
  {
    title: 'MDBList Collections',
    description:
      'Manage movie collections shown in the native MDBList Collections row.',
    ownerOnly: 'Only the server owner can manage MDBList collections.',
    apiKey: 'Configure an MDBList API key in General settings first.',
    url: 'MDBList URL',
    displayTitle: 'Display Title (Optional)',
    validate: 'Validate',
    save: 'Save Collection',
    edit: 'Edit Collection',
    delete: 'Delete Collection',
    deleteConfirm: 'Delete “{title}”?',
    empty: 'No MDBList collections have been configured.',
    items: '{count, plural, one {# item} other {# items}}',
    enabled: 'Toggle {title}',
    shuffle: 'Shuffle Artwork',
    refresh: 'Refresh Validation',
    sourceTitle: 'MDBList title: {title}',
    success: 'MDBList collection saved.',
    failed: 'Unable to manage this collection.',
  }
);

interface CollectionItem {
  id: number;
  title: string;
  sourceUrl: string;
  owner: string;
  slug: string;
  itemCount: number;
  enabled: boolean;
  sortOrder: number;
  selectedArtworkPosterPath?: string | null;
  metadata?: { sourceTitle?: string; preview?: PreviewItem[] } | null;
}
interface PreviewItem {
  tmdbId: number;
  title: string;
  posterPath: string;
  rank: number;
}
interface ManagerResponse {
  mdblistConfigured: boolean;
  items: CollectionItem[];
}
interface ValidationPreview {
  canonicalUrl: string;
  sourceTitle: string;
  displayTitle: string;
  owner: string;
  slug: string;
  mediaType: 'movie';
  itemCount: number;
  usableItemCount: number;
  preview: PreviewItem[];
}

const SettingsMdblistCollections = () => {
  const intl = useIntl();
  const router = useRouter();
  const { user } = useUser();
  const { addToast } = useToasts();
  const { data, error, mutate } = useSWR<ManagerResponse>(
    user?.id === 1 ? '/api/v1/settings/mdblist-collections' : null
  );
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<ValidationPreview | null>(null);
  const [editing, setEditing] = useState<CollectionItem | null>(null);
  const [deleting, setDeleting] = useState<CollectionItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  useEffect(() => {
    const editId = Number(router.query.edit);
    if (editId && data)
      setEditing(data.items.find((item) => item.id === editId) ?? null);
  }, [router.query.edit, data]);

  const message = (requestError: unknown) =>
    axios.isAxiosError(requestError) &&
    typeof requestError.response?.data?.message === 'string'
      ? requestError.response.data.message
      : intl.formatMessage(messages.failed);
  const refreshViews = async () => {
    await mutate();
    await globalMutate('/api/v1/discover/mdblist/collections');
    await globalMutate('/api/v1/settings/discover');
  };
  const validate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await axios.post<ValidationPreview>(
        '/api/v1/settings/mdblist-collections/validate',
        { url, ...(title.trim() ? { title } : {}) }
      );
      setPreview(response.data);
    } catch (requestError) {
      addToast(message(requestError), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await axios.post('/api/v1/settings/mdblist-collections', {
        url: preview.canonicalUrl,
        title: title.trim() || preview.displayTitle,
      });
      setUrl('');
      setTitle('');
      setPreview(null);
      await refreshViews();
      addToast(intl.formatMessage(messages.success), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (requestError) {
      addToast(message(requestError), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setBusy(false);
    }
  };
  const action = async (callback: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await callback();
      await refreshViews();
    } catch (requestError) {
      addToast(message(requestError), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setBusy(false);
    }
  };
  const reorder = async (ids: number[]) =>
    action(() =>
      axios.put('/api/v1/settings/mdblist-collections/reorder', { ids })
    );
  const move = (id: number, delta: number) => {
    if (!data) return;
    const ids = data.items.map((item) => item.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void reorder(ids);
  };

  if (user && user.id !== 1)
    return <Alert type="error">{intl.formatMessage(messages.ownerOnly)}</Alert>;
  if (error)
    return <Alert type="error">{intl.formatMessage(messages.failed)}</Alert>;

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.title)} />
      <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
      <p className="description">{intl.formatMessage(messages.description)}</p>
      {!data?.mdblistConfigured && (
        <Alert type="warning">{intl.formatMessage(messages.apiKey)}</Alert>
      )}
      <form
        onSubmit={validate}
        className="my-6 space-y-4 rounded-lg bg-gray-800 p-5 ring-1 ring-gray-700"
      >
        <div className="form-row">
          <label className="text-label" htmlFor="collectionUrl">
            {intl.formatMessage(messages.url)}
          </label>
          <div className="form-input-area">
            <input
              id="collectionUrl"
              required
              maxLength={500}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setPreview(null);
              }}
              placeholder="https://mdblist.com/lists/user/list-name"
            />
          </div>
        </div>
        <div className="form-row">
          <label className="text-label" htmlFor="collectionTitle">
            {intl.formatMessage(messages.displayTitle)}
          </label>
          <div className="form-input-area">
            <input
              id="collectionTitle"
              maxLength={100}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setPreview(null);
              }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            buttonType="primary"
            disabled={busy || !url.trim() || !data?.mdblistConfigured}
          >
            <ArrowPathIcon />
            <span>{intl.formatMessage(messages.validate)}</span>
          </Button>
        </div>
      </form>
      {preview && (
        <div className="mb-6 rounded-lg border border-green-700 bg-green-950/30 p-5">
          <h4 className="font-semibold text-white">{preview.displayTitle}</h4>
          <p className="text-sm text-gray-300">
            {intl.formatMessage(messages.sourceTitle, {
              title: preview.sourceTitle,
            })}{' '}
            · {intl.formatMessage(messages.items, { count: preview.itemCount })}
          </p>
          <div className="my-4 flex gap-2 overflow-x-auto">
            {preview.preview.map((item) => (
              <div
                key={item.tmdbId}
                className="relative h-32 w-20 shrink-0 overflow-hidden rounded"
              >
                <CachedImage
                  type="tmdb"
                  src={`https://image.tmdb.org/t/p/w300${item.posterPath}`}
                  alt={item.title}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button buttonType="success" onClick={save} disabled={busy}>
              <PlusIcon />
              <span>{intl.formatMessage(messages.save)}</span>
            </Button>
          </div>
        </div>
      )}
      {data?.items.length ? (
        <ul className="space-y-3">
          {data.items.map((item, index) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => setDraggedId(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedId && draggedId !== item.id) {
                  const ids = data.items.map((entry) => entry.id);
                  const from = ids.indexOf(draggedId);
                  ids.splice(from, 1);
                  ids.splice(index, 0, draggedId);
                  void reorder(ids);
                }
                setDraggedId(null);
              }}
              className="flex items-center gap-3 rounded-lg bg-gray-800 p-4 ring-1 ring-gray-700"
            >
              <ArrowsUpDownIcon className="h-6 w-6 cursor-grab text-gray-400" />
              <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded bg-gray-700">
                {item.selectedArtworkPosterPath && (
                  <CachedImage
                    type="tmdb"
                    src={`https://image.tmdb.org/t/p/w500${item.selectedArtworkPosterPath}`}
                    alt=""
                    fill
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-semibold text-white">
                  {item.title}
                </h4>
                <p className="truncate text-sm text-gray-400">
                  {item.sourceUrl}
                </p>
                <p className="text-sm text-gray-400">
                  {intl.formatMessage(messages.items, {
                    count: item.itemCount,
                  })}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div
                  aria-label={intl.formatMessage(messages.enabled, {
                    title: item.title,
                  })}
                >
                  <SlideCheckbox
                    checked={item.enabled}
                    onClick={() =>
                      void action(() =>
                        axios.put(
                          `/api/v1/settings/mdblist-collections/${item.id}/enabled`,
                          { enabled: !item.enabled }
                        )
                      )
                    }
                  />
                </div>
                <Button
                  buttonSize="sm"
                  disabled={index === 0 || busy}
                  onClick={() => move(item.id, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  buttonSize="sm"
                  disabled={index === data.items.length - 1 || busy}
                  onClick={() => move(item.id, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button buttonSize="sm" onClick={() => setEditing(item)}>
                  <PencilIcon />
                </Button>
                <Button
                  buttonSize="sm"
                  onClick={() =>
                    void action(() =>
                      axios.post(
                        `/api/v1/settings/mdblist-collections/${item.id}/shuffle-artwork`
                      )
                    )
                  }
                >
                  <ArrowsUpDownIcon />
                  <span>{intl.formatMessage(messages.shuffle)}</span>
                </Button>
                <Button
                  buttonSize="sm"
                  onClick={() =>
                    void action(() =>
                      axios.post(
                        `/api/v1/settings/mdblist-collections/${item.id}/refresh`
                      )
                    )
                  }
                >
                  <ArrowPathIcon />
                  <span>{intl.formatMessage(messages.refresh)}</span>
                </Button>
                <Button
                  buttonType="danger"
                  buttonSize="sm"
                  onClick={() => setDeleting(item)}
                >
                  <TrashIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg bg-gray-800 p-8 text-center text-gray-400">
          {intl.formatMessage(messages.empty)}
        </div>
      )}
      {editing && (
        <Modal
          title={intl.formatMessage(messages.edit)}
          onCancel={() => setEditing(null)}
          onOk={() =>
            void action(async () => {
              await axios.put(
                `/api/v1/settings/mdblist-collections/${editing.id}`,
                { title: editing.title }
              );
              setEditing(null);
            })
          }
        >
          <input
            maxLength={100}
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          />
        </Modal>
      )}
      {deleting && (
        <Modal
          title={intl.formatMessage(messages.delete)}
          okButtonType="danger"
          okText={intl.formatMessage(messages.delete)}
          onCancel={() => setDeleting(null)}
          onOk={() =>
            void action(async () => {
              await axios.delete(
                `/api/v1/settings/mdblist-collections/${deleting.id}`
              );
              setDeleting(null);
            })
          }
        >
          {intl.formatMessage(messages.deleteConfirm, {
            title: deleting.title,
          })}
        </Modal>
      )}
    </>
  );
};

export default SettingsMdblistCollections;
