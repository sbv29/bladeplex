import type { ReactNode } from 'react';

export const SERVER_OWNER_ID = 1;

export const isServerOwner = (userId?: number): boolean =>
  userId === SERVER_OWNER_ID;

export const serverOwnerAvatarClass = (userId?: number): string =>
  isServerOwner(userId) ? 'server-owner-avatar' : '';

interface ServerOwnerNameProps {
  userId?: number;
  children: ReactNode;
  className?: string;
}

export const ServerOwnerName = ({
  userId,
  children,
  className = '',
}: ServerOwnerNameProps) => (
  <span
    className={`${className} ${isServerOwner(userId) ? 'server-owner-name' : ''}`}
  >
    {children}
    {isServerOwner(userId) && (
      <span
        className="ml-1 inline-block align-middle text-[0.65em] leading-none"
        role="img"
        aria-label="Server owner"
      >
        👑
      </span>
    )}
  </span>
);
