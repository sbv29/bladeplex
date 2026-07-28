import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Modal from '@app/components/Common/Modal';
import useToasts from '@app/hooks/useToasts';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  HandThumbDownIcon,
  HandThumbUpIcon,
} from '@heroicons/react/24/outline';
import {
  HandThumbDownIcon as HandThumbDownSolidIcon,
  HandThumbUpIcon as HandThumbUpSolidIcon,
} from '@heroicons/react/24/solid';
import { CommunityReactionValue } from '@server/constants/communityReaction';
import type { MediaType } from '@server/constants/media';
import type {
  CommunityReactionSummary,
  CommunityReactionUser,
} from '@server/interfaces/api/communityReactionInterfaces';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.CommunityReactions', {
  community: 'Community',
  like: 'Like this {mediaType}',
  dislike: 'Dislike this {mediaType}',
  removelike: 'Remove like',
  removedislike: 'Remove dislike',
  likedby: 'Liked by:',
  dislikedby: 'Disliked by:',
  viewall: 'View all',
  reactions: 'Community reactions',
  updatefailed: 'Your reaction could not be updated. Please try again.',
  movie: 'movie',
  tv: 'series',
});

interface CommunityReactionsProps {
  mediaType: MediaType;
  tmdbId: number;
  variant?: 'sidebar' | 'actions';
  className?: string;
}

const PREVIEW_LIMIT = 5;

const UserList = ({ users }: { users: CommunityReactionUser[] }) => (
  <ul className="space-y-3">
    {users.map((reactionUser) => (
      <li key={reactionUser.id} className="flex items-center gap-3">
        <CachedImage
          type="avatar"
          src={reactionUser.avatar}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-full object-cover"
        />
        <span className="text-gray-100">{reactionUser.displayName}</span>
      </li>
    ))}
  </ul>
);

const CommunityReactions = ({
  mediaType,
  tmdbId,
  variant = 'sidebar',
  className = '',
}: CommunityReactionsProps) => {
  const intl = useIntl();
  const { user } = useUser();
  const { addToast } = useToasts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [animatingReaction, setAnimatingReaction] =
    useState<CommunityReactionValue | null>(null);
  const endpoint = `/api/v1/community-reactions/${mediaType}/${tmdbId}`;
  const { data, mutate } = useSWR<CommunityReactionSummary>(endpoint);

  useEffect(() => {
    if (animatingReaction === null) return;

    const timeout = window.setTimeout(() => setAnimatingReaction(null), 400);
    return () => window.clearTimeout(timeout);
  }, [animatingReaction]);

  if (!data) {
    if (variant === 'actions') return null;

    return (
      <div className="media-fact">
        <span>{intl.formatMessage(messages.community)}</span>
        <span className="media-fact-value" aria-hidden="true">
          …
        </span>
      </div>
    );
  }

  const updateReaction = async (reaction: CommunityReactionValue) => {
    if (isSubmitting || !user) return;
    setAnimatingReaction(reaction);
    const removing = data.currentUserReaction === reaction;
    const oldData = data;
    const publicUser = {
      id: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
    };
    const withoutCurrentUser = (users: CommunityReactionUser[]) =>
      users.filter(({ id }) => id !== user.id);
    const optimistic: CommunityReactionSummary = {
      ...data,
      currentUserReaction: removing ? null : reaction,
      likedBy:
        !removing && reaction === CommunityReactionValue.LIKE
          ? [...withoutCurrentUser(data.likedBy), publicUser]
          : withoutCurrentUser(data.likedBy),
      dislikedBy:
        !removing && reaction === CommunityReactionValue.DISLIKE
          ? [...withoutCurrentUser(data.dislikedBy), publicUser]
          : withoutCurrentUser(data.dislikedBy),
      likeCount: 0,
      dislikeCount: 0,
    };
    optimistic.likeCount = optimistic.likedBy.length;
    optimistic.dislikeCount = optimistic.dislikedBy.length;

    setIsSubmitting(true);
    await mutate(optimistic, { revalidate: false });
    try {
      const response = removing
        ? await axios.delete<CommunityReactionSummary>(endpoint)
        : await axios.put<CommunityReactionSummary>(endpoint, { reaction });
      await mutate(response.data, { revalidate: false });
    } catch {
      await mutate(oldData, { revalidate: false });
      addToast(intl.formatMessage(messages.updatefailed), {
        appearance: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const mediaLabel = intl.formatMessage(
    mediaType === 'movie' ? messages.movie : messages.tv
  );
  const preview = (users: CommunityReactionUser[]) =>
    users
      .slice(0, PREVIEW_LIMIT)
      .map(({ displayName }) => displayName)
      .join(', ');
  const hasLongList =
    data.likedBy.length > PREVIEW_LIMIT ||
    data.dislikedBy.length > PREVIEW_LIMIT;

  const reactionButtons = (
    <>
      <Button
        buttonSize={variant === 'actions' ? 'md' : 'sm'}
        buttonType={
          data.currentUserReaction === CommunityReactionValue.LIKE
            ? 'success'
            : 'default'
        }
        className={variant === 'actions' ? 'z-40 xl:mr-2' : undefined}
        disabled={isSubmitting}
        aria-pressed={data.currentUserReaction === CommunityReactionValue.LIKE}
        aria-label={intl.formatMessage(
          data.currentUserReaction === CommunityReactionValue.LIKE
            ? messages.removelike
            : messages.like,
          { mediaType: mediaLabel }
        )}
        onClick={() => updateReaction(CommunityReactionValue.LIKE)}
      >
        {data.currentUserReaction === CommunityReactionValue.LIKE ? (
          <HandThumbUpSolidIcon
            className={`mr-2 h-5 w-5 text-white ${
              animatingReaction === CommunityReactionValue.LIKE
                ? 'animate-community-reaction-like'
                : ''
            }`}
          />
        ) : (
          <HandThumbUpIcon
            className={`mr-2 h-5 w-5 text-white ${
              animatingReaction === CommunityReactionValue.LIKE
                ? 'animate-community-reaction-like'
                : ''
            }`}
          />
        )}
        <span className="text-white">{data.likeCount}</span>
      </Button>
      <Button
        buttonSize={variant === 'actions' ? 'md' : 'sm'}
        buttonType={
          data.currentUserReaction === CommunityReactionValue.DISLIKE
            ? 'danger'
            : 'default'
        }
        className={variant === 'actions' ? 'z-40 xl:mr-2' : undefined}
        disabled={isSubmitting}
        aria-pressed={
          data.currentUserReaction === CommunityReactionValue.DISLIKE
        }
        aria-label={intl.formatMessage(
          data.currentUserReaction === CommunityReactionValue.DISLIKE
            ? messages.removedislike
            : messages.dislike,
          { mediaType: mediaLabel }
        )}
        onClick={() => updateReaction(CommunityReactionValue.DISLIKE)}
      >
        {data.currentUserReaction === CommunityReactionValue.DISLIKE ? (
          <HandThumbDownSolidIcon
            className={`mr-2 h-5 w-5 text-white ${
              animatingReaction === CommunityReactionValue.DISLIKE
                ? 'animate-community-reaction-dislike'
                : ''
            }`}
          />
        ) : (
          <HandThumbDownIcon
            className={`mr-2 h-5 w-5 text-white ${
              animatingReaction === CommunityReactionValue.DISLIKE
                ? 'animate-community-reaction-dislike'
                : ''
            }`}
          />
        )}
        <span className="text-white">{data.dislikeCount}</span>
      </Button>
    </>
  );

  if (variant === 'actions') {
    return (
      <div
        className={`flex flex-wrap justify-center gap-2 xl:flex-nowrap xl:gap-0 ${className}`}
      >
        {reactionButtons}
      </div>
    );
  }

  return (
    <>
      <Transition show={showAll}>
        <Modal
          title={intl.formatMessage(messages.reactions)}
          onCancel={() => setShowAll(false)}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            {data.likedBy.length > 0 && (
              <div>
                <h3 className="mb-3 text-lg font-semibold text-white">
                  {intl.formatMessage(messages.likedby)}
                </h3>
                <UserList users={data.likedBy} />
              </div>
            )}
            {data.dislikedBy.length > 0 && (
              <div>
                <h3 className="mb-3 text-lg font-semibold text-white">
                  {intl.formatMessage(messages.dislikedby)}
                </h3>
                <UserList users={data.dislikedBy} />
              </div>
            )}
          </div>
        </Modal>
      </Transition>
      <div className="media-fact flex-col gap-2">
        <span>{intl.formatMessage(messages.community)}</span>
        <div className="media-fact-value flex w-full flex-wrap justify-end gap-2">
          {reactionButtons}
        </div>
        {data.likedBy.length > 0 && (
          <div className="flex w-full justify-between gap-3 text-xs text-gray-400">
            <span className="shrink-0">
              {intl.formatMessage(messages.likedby)}
            </span>
            <span className="text-right text-gray-300">
              {preview(data.likedBy)}
            </span>
          </div>
        )}
        {data.dislikedBy.length > 0 && (
          <div className="flex w-full justify-between gap-3 text-xs text-gray-400">
            <span className="shrink-0">
              {intl.formatMessage(messages.dislikedby)}
            </span>
            <span className="text-right text-gray-300">
              {preview(data.dislikedBy)}
            </span>
          </div>
        )}
        {hasLongList && (
          <button
            type="button"
            className="self-end text-xs font-medium text-indigo-400 hover:text-indigo-300"
            onClick={() => setShowAll(true)}
          >
            {intl.formatMessage(messages.viewall)}
          </button>
        )}
      </div>
    </>
  );
};

export default CommunityReactions;
