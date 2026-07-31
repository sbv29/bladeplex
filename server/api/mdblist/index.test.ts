import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import MdblistAPI from '@server/api/mdblist';

describe('MdblistAPI list pagination', () => {
  it('follows documented cursors and preserves source order', async () => {
    const api = new MdblistAPI('secret');
    const requestedCursors: (string | undefined)[] = [];
    const axiosClient = (
      api as unknown as {
        axios: {
          get: (
            path: string,
            config: { params: { cursor?: string } }
          ) => Promise<{ data: unknown }>;
        };
      }
    ).axios;

    mock.method(
      axiosClient,
      'get',
      async (_path: string, config: { params: { cursor?: string } }) => {
        requestedCursors.push(config.params.cursor);
        return config.params.cursor
          ? {
              data: {
                movies: [{ rank: 3, ids: { tmdb: 30 }, mediatype: 'movie' }],
                pagination: { has_more: false, next_cursor: null },
              },
            }
          : {
              data: {
                movies: [
                  { rank: 1, ids: { tmdb: 10 }, mediatype: 'movie' },
                  { rank: 2, ids: { tmdb: 20 }, mediatype: 'movie' },
                ],
                pagination: { has_more: true, next_cursor: 'next-page' },
              },
            };
      }
    );

    const movies = await api.getMovieList({
      reference: { type: 'public', username: 'owner', slug: 'movies' },
      limit: 1000,
    });

    assert.deepEqual(requestedCursors, [undefined, 'next-page']);
    assert.deepEqual(
      movies.map((movie) => movie.rank),
      [1, 2, 3]
    );
  });

  it('stops safely when an upstream cursor repeats', async () => {
    const api = new MdblistAPI('secret');
    let calls = 0;
    const axiosClient = (
      api as unknown as {
        axios: {
          get: () => Promise<{ data: unknown }>;
        };
      }
    ).axios;
    mock.method(axiosClient, 'get', async () => {
      calls += 1;
      return {
        data: {
          movies: [{ rank: calls, ids: { tmdb: calls }, mediatype: 'movie' }],
          pagination: { has_more: true, next_cursor: 'repeated' },
        },
      };
    });

    const movies = await api.getMovieList({
      reference: { type: 'public', username: 'owner', slug: 'movies' },
      limit: 1000,
    });

    assert.equal(calls, 2);
    assert.equal(movies.length, 2);
  });
});
