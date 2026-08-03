import type TheMovieDb from '@server/api/themoviedb';
import type CustomList from '@server/entity/CustomList';
import { MdblistProvider } from '@server/lib/mdblist';
import {
  createMdblistListReference,
  getMdblistReferenceKey,
} from '@server/lib/mdblistListUrl';
import logger from '@server/logger';

const MDBLIST_WARM_CONCURRENCY = 2;
const MDBLIST_WARM_QUEUE_LIMIT = 100;

interface WarmRequest {
  collection: CustomList;
  tmdb: TheMovieDb;
  language?: string;
  key: string;
}

type WarmCollection = (request: WarmRequest) => Promise<void>;

const warmCollection: WarmCollection = async ({
  collection,
  tmdb,
  language,
}) => {
  const provider = new MdblistProvider({
    list: createMdblistListReference(collection),
    mediaType: collection.mediaType,
  });
  await provider.getPreparedCollection({ tmdb, language });
};

export class MdblistCollectionWarmer {
  private activeCount = 0;
  private readonly queuedKeys = new Set<string>();
  private readonly queue: WarmRequest[] = [];

  constructor(
    private readonly warm: WarmCollection = warmCollection,
    private readonly concurrency = MDBLIST_WARM_CONCURRENCY,
    private readonly queueLimit = MDBLIST_WARM_QUEUE_LIMIT
  ) {}

  public enqueue(
    collections: CustomList[],
    { tmdb, language }: { tmdb: TheMovieDb; language?: string }
  ): void {
    for (const collection of collections) {
      const reference = createMdblistListReference(collection);
      const key = `${getMdblistReferenceKey(reference)}:${collection.mediaType}:${language ?? 'default'}`;
      if (this.queuedKeys.has(key) || this.queuedKeys.size >= this.queueLimit) {
        continue;
      }

      this.queuedKeys.add(key);
      this.queue.push({ collection, tmdb, language, key });
    }
    this.drain();
  }

  private drain(): void {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) return;

      this.activeCount += 1;
      void this.warm(request)
        .catch((error) => {
          logger.warn('Unable to warm MDBList collection cache', {
            label: 'MDBList',
            collectionId: request.collection.id,
            errorType:
              error instanceof Error ? error.constructor.name : 'UnknownError',
          });
        })
        .finally(() => {
          this.activeCount -= 1;
          this.queuedKeys.delete(request.key);
          this.drain();
        });
    }
  }
}

export const mdblistCollectionWarmer = new MdblistCollectionWarmer();
