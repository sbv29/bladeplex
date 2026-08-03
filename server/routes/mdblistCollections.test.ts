import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import CustomList from '@server/entity/CustomList';
import { User } from '@server/entity/User';
import { MdblistCollectionService } from '@server/lib/mdblistCollections';
import { Permission } from '@server/lib/permissions';
import discoverRoutes from '@server/routes/discover';
import collectionRoutes from '@server/routes/settings/mdblistCollections';
import express from 'express';
import request from 'supertest';

const createApp = (userId: number) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = new User({ id: userId, permissions: Permission.ADMIN });
    next();
  });
  app.use('/settings/mdblist-collections', collectionRoutes);
  app.use('/discover', discoverRoutes);
  app.use(
    (
      error: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => res.status(error.status ?? 500).json({ message: error.message })
  );
  return app;
};

beforeEach(() => {
  mock.method(MdblistCollectionService.prototype, 'validate', async () => ({
    canonicalUrl: 'https://mdblist.com/lists/owner/action',
    listType: 'public' as const,
    reference: { type: 'public' as const, username: 'owner', slug: 'action' },
    mdblistId: 44,
    sourceTitle: 'Action Movies',
    displayTitle: 'Action Movies',
    owner: 'owner',
    slug: 'action',
    mediaType: 'movie' as const,
    itemCount: 3,
    usableItemCount: 3,
    preview: [],
    movies: [],
    validatedAt: new Date(),
  }));
  mock.method(
    MdblistCollectionService.prototype,
    'create',
    async (input: { url: string; title?: string }) =>
      new CustomList({
        id: 42,
        provider: 'mdblist',
        listType: 'public',
        title: input.title ?? 'Action Movies',
        sourceUrl: input.url,
        username: 'owner',
        slug: 'action',
        mediaType: 'movie',
        itemCount: 3,
        enabled: true,
        sortOrder: 0,
      })
  );
});

afterEach(() => mock.restoreAll());

describe('MDBList collection routes', () => {
  it('denies a standard administrator before validation', async () => {
    const response = await request(createApp(2))
      .post('/settings/mdblist-collections/validate')
      .send({ url: 'https://mdblist.com/lists/owner/action' });
    assert.equal(response.status, 403);
  });

  it('returns a sanitized owner validation preview', async () => {
    const response = await request(createApp(1))
      .post('/settings/mdblist-collections/validate')
      .send({ url: 'https://mdblist.com/lists/owner/action' });
    assert.equal(response.status, 200);
    assert.equal(response.body.mediaType, 'movie');
    assert.equal(JSON.stringify(response.body).includes('apiKey'), false);
    assert.equal(JSON.stringify(response.body).includes('secret'), false);
  });

  it('creates through the stored collection service without returning credentials', async () => {
    const response = await request(createApp(1))
      .post('/settings/mdblist-collections')
      .send({
        url: 'https://mdblist.com/lists/owner/action',
        title: 'Action',
      });
    assert.equal(response.status, 201);
    assert.equal(response.body.id, 42);
    assert.equal(response.body.title, 'Action');
    assert.equal(JSON.stringify(response.body).includes('secret'), false);
  });
});
