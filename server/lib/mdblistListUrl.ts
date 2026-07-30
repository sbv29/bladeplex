import type {
  MdblistListReference,
  MdblistListType,
} from '@server/api/mdblist/interfaces';

export interface ParsedMdblistListUrl {
  canonicalUrl: string;
  listType: MdblistListType;
  reference: MdblistListReference;
  mediaType?: 'movie' | 'tv';
}

export class MdblistListValidationError extends Error {}

const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const OFFICIAL_API_SLUG_ALIASES: Record<string, string> = {
  'shows:streaming-charts': 'justwatch-streaming-charts',
};

const decodeSegment = (segment: string): string => {
  const decoded = decodeURIComponent(segment);
  if (!SAFE_SEGMENT.test(decoded)) {
    throw new MdblistListValidationError(
      'MDBList URL contains an invalid list identifier.'
    );
  }
  return decoded;
};

export const parseMdblistListUrl = (input: string): ParsedMdblistListUrl => {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new MdblistListValidationError('Enter a valid MDBList URL.');
  }

  if (url.protocol !== 'https:') {
    throw new MdblistListValidationError('MDBList URLs must use HTTPS.');
  }

  if (
    !['mdblist.com', 'www.mdblist.com'].includes(url.hostname.toLowerCase())
  ) {
    throw new MdblistListValidationError(
      'Only URLs from mdblist.com are supported.'
    );
  }

  if (url.port || url.username || url.password) {
    throw new MdblistListValidationError(
      'MDBList URLs cannot contain credentials or a custom port.'
    );
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'lists') {
    throw new MdblistListValidationError(
      'The URL must point to an MDBList list.'
    );
  }

  if (segments[1] === 'official') {
    const hasMediaSegment = segments.length === 4;
    if (
      (segments.length !== 3 && !hasMediaSegment) ||
      (hasMediaSegment && !['movies', 'shows'].includes(segments[2]))
    ) {
      throw new MdblistListValidationError(
        'Official MDBList URLs must contain /movies/ or /shows/.'
      );
    }
    const slug = decodeSegment(segments[hasMediaSegment ? 3 : 2]);
    const mediaSegment = hasMediaSegment ? segments[2] : 'movies';
    const apiSlug =
      OFFICIAL_API_SLUG_ALIASES[`${mediaSegment}:${slug}`] ?? slug;
    return {
      canonicalUrl: `https://mdblist.com/lists/official/${mediaSegment}/${slug}`,
      listType: 'official',
      reference: { type: 'official', slug: apiSlug },
      mediaType: mediaSegment === 'shows' ? 'tv' : 'movie',
    };
  }

  if (segments.length !== 3) {
    throw new MdblistListValidationError(
      'Enter a public MDBList URL in /lists/user/list format.'
    );
  }

  const username = decodeSegment(segments[1]);
  const slug = decodeSegment(segments[2]);
  return {
    canonicalUrl: `https://mdblist.com/lists/${username}/${slug}`,
    listType: 'public',
    reference: { type: 'public', username, slug },
  };
};

export const getMdblistReferenceKey = (
  reference: MdblistListReference
): string =>
  reference.type === 'official'
    ? `official:${reference.slug}`
    : `public:${reference.username}:${reference.slug}`;

export const createMdblistListReference = (list: {
  listType: MdblistListType;
  username: string;
  slug: string;
}): MdblistListReference =>
  list.listType === 'official'
    ? { type: 'official', slug: list.slug }
    : { type: 'public', username: list.username, slug: list.slug };
