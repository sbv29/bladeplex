import ExternalAPI from '@server/api/externalapi';
import { MediaType } from '@server/constants/media';
import { z } from 'zod';

const MDBLIST_API_URL = 'https://api.mdblist.com';
const MDBLIST_RATINGS_TIMEOUT_MS = 10_000;

const MdblistRatingSchema = z.object({
  source: z.string(),
  value: z.number().nullable().optional(),
  votes: z.number().int().nonnegative().nullable().optional(),
});

const MdblistRatingItemSchema = z.object({
  title: z.string().optional(),
  ids: z.object({
    tmdb: z.number().int().positive(),
    imdb: z.string().nullable().optional(),
  }),
  ratings: z.array(MdblistRatingSchema).optional().default([]),
});

const MdblistRatingBatchSchema = z.array(MdblistRatingItemSchema);

export interface MdblistImdbRating {
  tmdbId: number;
  imdbId?: string;
  title?: string;
  rating: number;
  votes: number;
}

export interface MdblistQuotaSnapshot {
  limit?: number;
  remaining?: number;
  resetAt?: Date;
}

export interface MdblistRatingBatchResult {
  ratings: MdblistImdbRating[];
  returnedTmdbIds: Set<number>;
  quota: MdblistQuotaSnapshot;
}

const parseHeaderInteger = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

class MdblistRatingsAPI extends ExternalAPI {
  constructor(apiKey: string) {
    super(
      MDBLIST_API_URL,
      { apikey: apiKey },
      {
        timeout: MDBLIST_RATINGS_TIMEOUT_MS,
        rateLimit: { maxRequests: 1, maxRPS: 1 },
      }
    );
  }

  public async getImdbRatings(
    mediaType: MediaType.MOVIE | MediaType.TV,
    tmdbIds: number[]
  ): Promise<MdblistRatingBatchResult> {
    const response = await this.axios.post<unknown>(
      `/tmdb/${mediaType === MediaType.TV ? 'show' : 'movie'}/`,
      { ids: tmdbIds }
    );
    const items = MdblistRatingBatchSchema.parse(response.data);
    const returnedTmdbIds = new Set(items.map((item) => item.ids.tmdb));
    const ratings = items.flatMap((item) => {
      const imdb = item.ratings.find((rating) => rating.source === 'imdb');
      if (imdb?.value == null || imdb.votes == null) return [];
      return [
        {
          tmdbId: item.ids.tmdb,
          imdbId: item.ids.imdb ?? undefined,
          title: item.title,
          rating: imdb.value,
          votes: imdb.votes,
        },
      ];
    });
    const reset = parseHeaderInteger(response.headers['x-ratelimit-reset']);

    return {
      ratings,
      returnedTmdbIds,
      quota: {
        limit: parseHeaderInteger(response.headers['x-ratelimit-limit']),
        remaining: parseHeaderInteger(
          response.headers['x-ratelimit-remaining']
        ),
        resetAt: reset ? new Date(reset * 1000) : undefined,
      },
    };
  }
}

export default MdblistRatingsAPI;
