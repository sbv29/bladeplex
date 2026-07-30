import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MdblistListValidationError,
  parseMdblistListUrl,
} from '@server/lib/mdblistListUrl';

describe('parseMdblistListUrl', () => {
  it('normalizes official movie list URLs', () => {
    assert.deepEqual(
      parseMdblistListUrl(
        'https://www.mdblist.com/lists/official/movies/justwatch-streaming-charts?ignored=1'
      ),
      {
        canonicalUrl:
          'https://mdblist.com/lists/official/movies/justwatch-streaming-charts',
        listType: 'official',
        reference: {
          type: 'official',
          slug: 'justwatch-streaming-charts',
        },
      }
    );

    assert.deepEqual(
      parseMdblistListUrl(
        'https://mdblist.com/lists/official/movies/justwatch-streaming-charts'
      ),
      {
        canonicalUrl:
          'https://mdblist.com/lists/official/movies/justwatch-streaming-charts',
        listType: 'official',
        reference: {
          type: 'official',
          slug: 'justwatch-streaming-charts',
        },
      }
    );
  });

  it('normalizes public user list URLs', () => {
    assert.deepEqual(
      parseMdblistListUrl('https://mdblist.com/lists/scott/weekend-movies/'),
      {
        canonicalUrl: 'https://mdblist.com/lists/scott/weekend-movies',
        listType: 'public',
        reference: {
          type: 'public',
          username: 'scott',
          slug: 'weekend-movies',
        },
      }
    );
  });

  it('rejects arbitrary hosts, credentials, and non-list URLs', () => {
    const invalidUrls = [
      'https://example.com/lists/scott/movies',
      'http://mdblist.com/lists/scott/movies',
      'https://user:pass@mdblist.com/lists/scott/movies',
      'https://mdblist.com/movie/example',
      'https://mdblist.com/lists/official/shows/example',
    ];

    for (const url of invalidUrls) {
      assert.throws(() => parseMdblistListUrl(url), MdblistListValidationError);
    }
  });

  it('returns a specific validation reason for unsafe URLs', () => {
    assert.throws(
      () => parseMdblistListUrl('http://mdblist.com/lists/scott/movies'),
      { message: 'MDBList URLs must use HTTPS.' }
    );
    assert.throws(
      () => parseMdblistListUrl('https://example.com/lists/scott/movies'),
      { message: 'Only URLs from mdblist.com are supported.' }
    );
  });
});
