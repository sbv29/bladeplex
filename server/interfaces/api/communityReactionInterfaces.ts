import type { CommunityReactionValue } from '@server/constants/communityReaction';
import type { MediaType } from '@server/constants/media';

export interface CommunityReactionUser {
  id: number;
  displayName: string;
  avatar: string;
}

export interface CommunityReactionSummary {
  mediaType: MediaType;
  tmdbId: number;
  likeCount: number;
  dislikeCount: number;
  currentUserReaction: CommunityReactionValue | null;
  likedBy: CommunityReactionUser[];
  dislikedBy: CommunityReactionUser[];
}
