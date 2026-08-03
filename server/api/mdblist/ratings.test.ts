import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import MdblistRatingsAPI from '@server/api/mdblist/ratings';
import { MediaType } from '@server/constants/media';

describe('MDBList IMDb rating batches', () => {
  it('extracts only IMDb ratings and authoritative TMDb identifiers', async () => {
    const api = new MdblistRatingsAPI('secret');
    const client = (
      api as unknown as {
        axios: {
          post: () => Promise<{
            data: unknown;
            headers: Record<string, string>;
          }>;
        };
      }
    ).axios;
    mock.method(client, 'post', async () => ({
      data: [
        {
          title: 'Ride or Die',
          ids: { tmdb: 241882, imdb: 'tt30494226' },
          ratings: [
            { source: 'tmdb', value: 7.8, votes: 100 },
            { source: 'imdb', value: 7.5, votes: 914 },
          ],
        },
      ],
      headers: {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '848',
        'x-ratelimit-reset': '1785801600',
      },
    }));

    const result = await api.getImdbRatings(MediaType.TV, [241882]);

    assert.deepEqual(result.ratings[0], {
      tmdbId: 241882,
      imdbId: 'tt30494226',
      title: 'Ride or Die',
      rating: 7.5,
      votes: 914,
    });
    assert.deepEqual(result.quota.limit, 1000);
    assert.deepEqual(result.quota.remaining, 848);
  });

  it('keeps partial results visible to the cache service', async () => {
    const api = new MdblistRatingsAPI('secret');
    const client = (
      api as unknown as {
        axios: {
          post: () => Promise<{
            data: unknown;
            headers: Record<string, string>;
          }>;
        };
      }
    ).axios;
    mock.method(client, 'post', async () => ({
      data: [
        {
          ids: { tmdb: 550, imdb: 'tt0137523' },
          ratings: [{ source: 'imdb', value: 8.8, votes: 2_600_000 }],
        },
        {
          ids: { tmdb: 155, imdb: 'tt0468569' },
          ratings: [],
        },
      ],
      headers: {},
    }));

    const result = await api.getImdbRatings(MediaType.MOVIE, [550, 155, 238]);

    assert.deepEqual(
      result.ratings.map((item) => item.tmdbId),
      [550]
    );
    assert.deepEqual([...result.returnedTmdbIds], [550, 155]);
  });
});
