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
    const response = await this.get<unknown>(
      `${this.getListPath(reference)}/items`,
      {
        params: {
          mediatype: 'movie',
          limit,
          sort: 'rank',
          order: 'asc',
        },
      }
    );

    return MdblistListItemsResponseSchema.parse(response).movies;
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
    const response = await this.get<unknown>(
      `${this.getListPath(reference)}/items`,
      {
        params: { mediatype: 'show', limit, sort: 'rank', order: 'asc' },
      }
    );

    return MdblistShowListItemsResponseSchema.parse(response).shows;
  }
}

export default MdblistAPI;
