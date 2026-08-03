import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type TheMovieDb from '@server/api/themoviedb';
import type CustomList from '@server/entity/CustomList';
import { MdblistCollectionWarmer } from '@server/lib/mdblistCollectionWarmer';

const collection = (id: number): CustomList =>
  ({
    id,
    listType: 'public',
    username: 'owner',
    slug: `list-${id}`,
    mediaType: 'movie',
  }) as CustomList;

const flushPromises = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

describe('MdblistCollectionWarmer', () => {
  it('deduplicates queued collections and limits concurrent warming', async () => {
    const started: number[] = [];
    const releases: (() => void)[] = [];
    const warmer = new MdblistCollectionWarmer(async ({ collection: item }) => {
      started.push(item.id);
      await new Promise<void>((resolve) => releases.push(resolve));
    }, 2);
    const tmdb = {} as TheMovieDb;

    warmer.enqueue(
      [collection(1), collection(1), collection(2), collection(3)],
      {
        tmdb,
        language: 'en',
      }
    );
    await flushPromises();
    assert.deepEqual(started, [1, 2]);

    releases.shift()?.();
    await flushPromises();
    assert.deepEqual(started, [1, 2, 3]);

    releases.splice(0).forEach((release) => release());
    await flushPromises();
  });

  it('releases a failed collection so later work can continue', async () => {
    const started: number[] = [];
    const warmer = new MdblistCollectionWarmer(async ({ collection: item }) => {
      started.push(item.id);
      if (item.id === 1) throw new Error('upstream failed');
    }, 1);

    warmer.enqueue([collection(1), collection(2)], {
      tmdb: {} as TheMovieDb,
    });
    await flushPromises();
    await flushPromises();

    assert.deepEqual(started, [1, 2]);
  });
});
