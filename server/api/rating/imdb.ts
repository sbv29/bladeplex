import ExternalAPI from '@server/api/externalapi';
import type { IMDBRating } from '@server/api/rating/imdbRadarrProxy';
import cacheManager from '@server/lib/cache';

interface ImdbGraphqlResponse {
  data?: {
    title?: {
      id: string;
      titleText?: { text?: string };
      ratingsSummary?: {
        aggregateRating?: number;
        voteCount?: number;
      };
    };
  };
}

class ImdbApi extends ExternalAPI {
  constructor() {
    super(
      'https://api.graphql.imdb.com',
      {},
      {
        headers: { 'Content-Type': 'application/json' },
        nodeCache: cacheManager.getCache('imdb').data,
      }
    );
  }

  public async getTitleRating(
    imdbId: string,
    forceRefresh = false
  ): Promise<IMDBRating | null> {
    const endpoint = '/';
    const request = {
      query:
        'query TitleRating($id: ID!) { title(id: $id) { id titleText { text } ratingsSummary { aggregateRating voteCount } } }',
      variables: { id: imdbId },
    };
    if (forceRefresh) this.removeCache(endpoint, { data: request });

    const response = await this.post<ImdbGraphqlResponse>(endpoint, request);
    const title = response.data?.title;
    const score = title?.ratingsSummary?.aggregateRating;
    const count = title?.ratingsSummary?.voteCount;

    if (title?.id !== imdbId || score == null || count == null) return null;

    return {
      title: title.titleText?.text ?? '',
      url: `https://www.imdb.com/title/${imdbId}`,
      criticsScore: score,
      criticsScoreCount: count,
    };
  }
}

export default ImdbApi;
