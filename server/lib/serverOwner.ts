import type { User } from '@server/entity/User';

/**
 * BladePlex establishes the first persisted user as the server owner.
 * Keep that legacy invariant centralized instead of coupling routes to it.
 */
export const SERVER_OWNER_USER_ID = 1;

export const isServerOwner = (
  user?: Pick<User, 'id'> | null
): user is Pick<User, 'id'> => user?.id === SERVER_OWNER_USER_ID;
