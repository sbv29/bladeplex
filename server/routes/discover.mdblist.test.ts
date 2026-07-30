import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { getRepository } from '@server/datasource';
import CustomList from '@server/entity/CustomList';
import { MdblistProvider } from '@server/lib/mdblist';
import { checkUser } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import discoverRoutes from '@server/routes/discover';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

let app: Express;

setupTestDb();

before(() => {
  app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(checkUser);
  app.use('/auth', authRoutes);
  app.use('/discover', discoverRoutes);
});

beforeEach(async () => {
  await getRepository(CustomList).save(
    new CustomList({
      id: 42,
      provider: 'mdblist',
      listType: 'public',
      title: 'Weekend Movies',
      sourceUrl: 'https://mdblist.com/lists/scott/weekend-movies',
      username: 'scott',
      slug: 'weekend-movies',
      mediaType: 'movie',
      itemCount: 1,
    })
  );
});

afterEach(() => {
  mock.restoreAll();
});

const login = async () => {
  const agent = request.agent(app);
  assert.equal(
    (
      await agent
        .post('/auth/local')
        .send({ email: 'admin@seerr.dev', password: 'test1234' })
    ).status,
    200
  );
  return agent;
};

describe('custom MDBList discovery route', () => {
  it('returns the persisted title and native paginated provider result', async () => {
    mock.method(
      MdblistProvider.prototype,
      'getStreamingChartPage',
      async () => ({
        page: 1,
        totalPages: 1,
        totalResults: 1,
        results: [{ id: 550, mediaType: 'movie', mdblistRank: 1 }],
      })
    );
    const agent = await login();

    const response = await agent.get('/discover/mdblist/lists/42/movies');

    assert.equal(response.status, 200);
    assert.equal(response.body.title, 'Weekend Movies');
    assert.equal(response.body.totalResults, 1);
    assert.equal(response.body.results[0].id, 550);
    assert.equal(JSON.stringify(response.body).includes('apikey'), false);
  });

  it('returns a native empty result when the optional provider fails', async () => {
    mock.method(
      MdblistProvider.prototype,
      'getStreamingChartPage',
      async () => {
        throw new Error('upstream unavailable');
      }
    );
    const agent = await login();

    const response = await agent.get('/discover/mdblist/lists/42/movies');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      page: 1,
      totalPages: 1,
      totalResults: 0,
      results: [],
      title: 'Weekend Movies',
    });
  });

  it('returns 404 for an unknown list identifier', async () => {
    const agent = await login();
    assert.equal(
      (await agent.get('/discover/mdblist/lists/999/movies')).status,
      404
    );
  });
});
