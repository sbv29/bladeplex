import { type IMDBRating } from '@server/api/rating/imdbRadarrProxy';
import { type RTRating } from '@server/api/rating/rottentomatoes';
import type { MediaType } from '@server/constants/media';

export interface RatingResponse {
  rt?: RTRating;
  imdb?: IMDBRating;
}

export interface ImdbRatingBatchResponse {
  ratings: Record<string, IMDBRating | null>;
}

export interface ImdbRatingBatchRequest {
  tmdbIds?: number[];
  mediaType?: MediaType.MOVIE | MediaType.TV;
}
