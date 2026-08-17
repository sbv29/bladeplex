import type {
  MobileAnnouncementColor,
  MobileAnnouncementDurationDays,
} from '@server/lib/settings';
import type { DnsEntries, DnsStats } from 'dns-caching';
import type { PaginatedResponse } from './common';

export type LogMessage = {
  timestamp: string;
  level: string;
  label?: string;
  message: string;
  data?: Record<string, unknown>;
};

export interface LogsResultsResponse extends PaginatedResponse {
  results: LogMessage[];
}

export interface SettingsAboutResponse {
  version: string;
  bladeplexVersion: string;
  commitTag: string;
  commit: string;
  branch: string;
  nodeVersion: string;
  environment: string;
  deploymentType: 'docker' | 'local';
  databaseType: 'postgres' | 'sqlite';
  upstreamVersion?: string;
  latestUpstreamVersion?: string;
  upstreamStatus:
    | 'up-to-date'
    | 'update-available'
    | 'unavailable'
    | 'disabled';
  totalRequests: number;
  totalMediaItems: number;
  tz?: string;
  appDataPath: string;
}

export interface PublicSettingsResponse {
  jellyfinHost?: string;
  jellyfinExternalHost?: string;
  jellyfinServerName?: string;
  jellyfinForgotPasswordUrl?: string;
  initialized: boolean;
  applicationTitle: string;
  applicationUrl: string;
  hideAvailable: boolean;
  hideBlocklisted: boolean;
  localLogin: boolean;
  mediaServerLogin: boolean;
  movie4kEnabled: boolean;
  series4kEnabled: boolean;
  discoverRegion: string;
  streamingRegion: string;
  originalLanguage: string;
  mediaServerType: number;
  partialRequestsEnabled: boolean;
  enableSpecialEpisodes: boolean;
  cacheImages: boolean;
  vapidPublic: string;
  enablePushRegistration: boolean;
  locale: string;
  emailEnabled: boolean;
  newPlexLogin: boolean;
  youtubeUrl: string;
  versionCheck: boolean;
  statusIndicatorEnabled: boolean;
  statusPageUrl: string;
  statusIndicatorRevision: number;
  plexClientIdentifier: string;
  mobileAnnouncementEnabled: boolean;
  mobileAnnouncementMessage: string;
  mobileAnnouncementColor: MobileAnnouncementColor;
  mobileAnnouncementRevision: number;
  mobileAnnouncementDurationDays: MobileAnnouncementDurationDays;
  mobileAnnouncementExpiresAt: string | null;
}

export interface CacheItem {
  id: string;
  name: string;
  persistent?: boolean;
  stats: {
    hits: number;
    misses: number;
    keys: number;
    ksize: number;
    vsize: number;
  };
}

export interface CacheResponse {
  apiCaches: CacheItem[];
  imageCache: Record<'tmdb' | 'avatar', { size: number; imageCount: number }>;
  dnsCache: {
    stats: DnsStats | undefined;
    entries: DnsEntries | undefined;
  };
}

export interface StatusResponse {
  version: string;
  commitTag: string;
  updateAvailable?: boolean;
  commitsBehind?: number;
  restartRequired: boolean;
}
