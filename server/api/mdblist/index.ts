import ExternalAPI from '@server/api/externalapi';
import {
  MdblistListItemsResponseSchema,
  MdblistListMetadataSchema,
  MdblistShowListItemsResponseSchema,
  type MdblistListMetadata,
  type MdblistListReference,
  type MdblistMovieItem,
  type MdblistShowItem,
} from '@server/api/mdblist/interfaces';

const MDBLIST_API_URL = 'https://api.mdblist.com';
const MDBLIST_REQUEST_TIMEOUT_MS = 10_000;
const MDBLIST_LIST_PAGE_SIZE = 1000;
export const MDBLIST_MAX_LIST_ITEMS = 10_000;

class MdblistAPI extends ExternalAPI {
  constructor(apiKey: string) {
    super(
      MDBLIST_API_URL,
      { apikey: apiKey },
      {
        timeout: MDBLIST_REQUEST_TIMEOUT_MS,
        rateLimit: { maxRequests: 1, maxRPS: 1 },
      }
    );
  }

  private getListPath(reference: MdblistListReference): string {
    if (reference.type === 'official') {
      return `/lists/official/${encodeURIComponent(reference.slug)}`;
    }

    return `/lists/${encodeURIComponent(reference.username)}/${encodeURIComponent(
      reference.slug
    )}`;
  }

  public async getListMetadata(
    reference: MdblistListReference
  ): Promise<MdblistListMetadata> {
    const response = await this.get<unknown>(this.getListPath(reference));

    return MdblistListMetadataSchema.parse(response);
  }

  public async getMovieList({
    reference,
    limit = 1000,
  }: {
    reference: MdblistListReference;
    limit?: number;
  }): Promise<MdblistMovieItem[]> {
    const requestedLimit = Math.min(
      Math.max(1, Math.floor(limit)),
      MDBLIST_MAX_LIST_ITEMS
    );
    const items: MdblistMovieItem[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    let pagesFetched = 0;

    do {
      const response = await this.get<unknown>(
        `${this.getListPath(reference)}/items`,
        {
          params: {
            mediatype: 'movie',
            limit: Math.min(
              MDBLIST_LIST_PAGE_SIZE,
              requestedLimit - items.length
            ),
            sort: 'rank',
            order: 'asc',
            ...(cursor ? { cursor } : {}),
          },
        }
      );
      pagesFetched += 1;
      const page = MdblistListItemsResponseSchema.parse(response);
      const sourceOffset = items.length;
      const movies = page.movies.map((movie, index) => ({
        ...movie,
        // Some manually ordered or mixed-media lists return null ranks.
        // MDBList's observed numeric ranks use 1000-point source positions.
        rank: movie.rank || (sourceOffset + index + 1) * 1000,
      }));
      items.push(...movies.slice(0, requestedLimit - items.length));

      const nextCursor = page.pagination?.next_cursor ?? undefined;
      if (
        items.length >= requestedLimit ||
        page.pagination?.has_more === false ||
        !nextCursor ||
        seenCursors.has(nextCursor)
      ) {
        break;
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    } while (
      items.length < requestedLimit &&
      pagesFetched < Math.ceil(MDBLIST_MAX_LIST_ITEMS / MDBLIST_LIST_PAGE_SIZE)
    );

    return items;
  }

  public async getOfficialMovieList({
    slug,
    limit = 1000,
  }: {
    slug: string;
    limit?: number;
  }): Promise<MdblistMovieItem[]> {
    return this.getMovieList({
      reference: { type: 'official', slug },
      limit,
    });
  }

  public async getShowList({
    reference,
    limit = 1000,
  }: {
    reference: MdblistListReference;
    limit?: number;
  }): Promise<MdblistShowItem[]> {
    const requestedLimit = Math.min(
      Math.max(1, Math.floor(limit)),
      MDBLIST_MAX_LIST_ITEMS
    );
    const items: MdblistShowItem[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    let pagesFetched = 0;

    do {
      const response = await this.get<unknown>(
        `${this.getListPath(reference)}/items`,
        {
          params: {
            mediatype: 'show',
            limit: Math.min(
              MDBLIST_LIST_PAGE_SIZE,
              requestedLimit - items.length
            ),
            sort: 'rank',
            order: 'asc',
            ...(cursor ? { cursor } : {}),
          },
        }
      );
      pagesFetched += 1;
      const page = MdblistShowListItemsResponseSchema.parse(response);
      const sourceOffset = items.length;
      const shows = page.shows.map((show, index) => ({
        ...show,
        rank: show.rank || (sourceOffset + index + 1) * 1000,
      }));
      items.push(...shows.slice(0, requestedLimit - items.length));

      const nextCursor = page.pagination?.next_cursor ?? undefined;
      if (
        items.length >= requestedLimit ||
        page.pagination?.has_more === false ||
        !nextCursor ||
        seenCursors.has(nextCursor)
      ) {
        break;
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    } while (
      items.length < requestedLimit &&
      pagesFetched < Math.ceil(MDBLIST_MAX_LIST_ITEMS / MDBLIST_LIST_PAGE_SIZE)
    );

    return items;
  }
}

export default MdblistAPI;
