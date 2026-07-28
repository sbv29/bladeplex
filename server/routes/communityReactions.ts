import { CommunityReactionValue } from '@server/constants/communityReaction';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { CommunityReaction } from '@server/entity/CommunityReaction';
import type { CommunityReactionSummary } from '@server/interfaces/api/communityReactionInterfaces';
import { Router } from 'express';
import { z } from 'zod';

const communityReactionRoutes = Router();

const paramsSchema = z.object({
  mediaType: z.enum([MediaType.MOVIE, MediaType.TV]),
  tmdbId: z.coerce.number().int().positive(),
});

const reactionSchema = z.object({
  reaction: z.enum([
    CommunityReactionValue.LIKE,
    CommunityReactionValue.DISLIKE,
  ]),
});

async function getSummary(
  mediaType: MediaType,
  tmdbId: number,
  userId: number
): Promise<CommunityReactionSummary> {
  const reactions = await getRepository(CommunityReaction).find({
    where: { mediaType, tmdbId },
    relations: { user: true },
    order: { createdAt: 'ASC' },
  });
  const toPublicUser = ({ user }: CommunityReaction) => ({
    id: user.id,
    displayName: user.displayName,
    avatar: user.avatar,
  });
  const likes = reactions.filter(
    ({ reaction }) => reaction === CommunityReactionValue.LIKE
  );
  const dislikes = reactions.filter(
    ({ reaction }) => reaction === CommunityReactionValue.DISLIKE
  );

  return {
    mediaType,
    tmdbId,
    likeCount: likes.length,
    dislikeCount: dislikes.length,
    currentUserReaction:
      reactions.find(({ user }) => user.id === userId)?.reaction ?? null,
    likedBy: likes.map(toPublicUser),
    dislikedBy: dislikes.map(toPublicUser),
  };
}

communityReactionRoutes.get('/:mediaType/:tmdbId', async (req, res, next) => {
  try {
    if (!req.user) {
      return next({ status: 401, message: 'Authentication required.' });
    }
    const { mediaType, tmdbId } = paramsSchema.parse(req.params);
    return res
      .status(200)
      .json(await getSummary(mediaType, tmdbId, req.user.id));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next({ status: 400, message: 'Invalid reaction parameters.' });
    }
    return next(error);
  }
});

communityReactionRoutes.put('/:mediaType/:tmdbId', async (req, res, next) => {
  try {
    if (!req.user) {
      return next({ status: 401, message: 'Authentication required.' });
    }
    const { mediaType, tmdbId } = paramsSchema.parse(req.params);
    const { reaction } = reactionSchema.parse(req.body);
    const repository = getRepository(CommunityReaction);
    let communityReaction = await repository.findOneBy({
      user: { id: req.user.id },
      mediaType,
      tmdbId,
    });

    if (communityReaction) {
      communityReaction.reaction = reaction;
    } else {
      communityReaction = new CommunityReaction({
        user: req.user,
        mediaType,
        tmdbId,
        reaction,
      });
    }
    await repository.save(communityReaction);
    return res
      .status(200)
      .json(await getSummary(mediaType, tmdbId, req.user.id));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next({ status: 400, message: 'Invalid reaction.' });
    }
    return next(error);
  }
});

communityReactionRoutes.delete(
  '/:mediaType/:tmdbId',
  async (req, res, next) => {
    try {
      if (!req.user) {
        return next({ status: 401, message: 'Authentication required.' });
      }
      const { mediaType, tmdbId } = paramsSchema.parse(req.params);
      await getRepository(CommunityReaction).delete({
        user: { id: req.user.id },
        mediaType,
        tmdbId,
      });
      return res
        .status(200)
        .json(await getSummary(mediaType, tmdbId, req.user.id));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next({ status: 400, message: 'Invalid reaction parameters.' });
      }
      return next(error);
    }
  }
);

export default communityReactionRoutes;
