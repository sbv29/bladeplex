import { type IMDBRating } from '@server/api/rating/imdbRadarrProxy';
import { type RTRating } from '@server/api/rating/rottentomatoes';

export interface RatingResponse {
  rt?: RTRating;
  imdb?: IMDBRating;
}

export interface ImdbRatingBatchResponse {
  ratings: Record<string, IMDBRating | null>;
}
