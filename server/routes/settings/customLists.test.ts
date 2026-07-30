import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import MdblistAPI from '@server/api/mdblist';
import type { MdblistListReference } from '@server/api/mdblist/interfaces';
import { DiscoverSliderType } from '@server/constants/discover';
import { getRepository } from '@server/datasource';
import CustomList from '@server/entity/CustomList';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import { bootstrapCustomListSliders } from '@server/lib/customLists';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import customListRoutes from '@server/routes/settings/customLists';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

let app: Express;
const settings = getSettings();
const originalApiKey = settings.main.mdblistApiKey;

const sourceMovie = (rank: number, tmdbId: number) => ({
  rank,
  adult: 0,
  title: `Movie ${tmdbId}`,
  release_year: 2026,
  ids: { tmdb: tmdbId, mdblist: `movie-${tmdbId}` },
  mediatype: 'movie' as const,
});
const sourceShow = (rank: number, tmdbId: number) => ({
  rank,
  adult: 0,
  title: `Show ${tmdbId}`,
  release_year: 2026,
  ids: { tmdb: tmdbId, mdblist: `show-${tmdbId}` },
  mediatype: 'show' as const,
});

const createApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  testApp.use(checkUser);
  testApp.use('/auth', authRoutes);
  testApp.use(
    '/settings/custom-lists',
    isAuthenticated(Permission.ADMIN),
    customListRoutes
  );
  testApp.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) =>
      res
        .status(err.status ?? 500)
        .json({ status: err.status ?? 500, message: err.message })
  );
  return testApp;
};

setupTestDb();

before(() => {
  app = createApp();
});

beforeEach(() => {
  settings.main.mdblistApiKey = 'configured-secret';
  mock.method(
    MdblistAPI.prototype,
    'getListMetadata',
    async (reference: MdblistListReference) => ({
      id: 10,
      name:
        reference.type === 'official' ? 'Official Movies' : 'Public Movie List',
      slug: reference.slug,
      private: false,
      mediatype: 'movie',
      user_name: reference.type === 'public' ? reference.username : 'official',
      items: 2,
    })
  );
  mock.method(MdblistAPI.prototype, 'getMovieList', async () => [
    sourceMovie(1, 100),
    sourceMovie(2, 200),
  ]);
  mock.method(MdblistAPI.prototype, 'getShowList', async () => [
    sourceShow(1, 300),
    sourceShow(2, 400),
  ]);
});

afterEach(async () => {
  mock.restoreAll();
  settings.main.mdblistApiKey = originalApiKey;
  await getRepository(DiscoverSlider).clear();
  await getRepository(CustomList).clear();
});

const loginAs = async (email: string) => {
  const agent = request.agent(app);
  const response = await agent
    .post('/auth/local')
    .send({ email, password: 'test1234' });
  assert.equal(response.status, 200);
  return agent;
};

describe('custom MDBList settings', () => {
  it('reports missing configuration and rejects validation without a key', async () => {
    settings.main.mdblistApiKey = '';
    const owner = await loginAs('admin@seerr.dev');

    const listResponse = await owner.get('/settings/custom-lists');
    const validationResponse = await owner
      .post('/settings/custom-lists/validate')
      .send({ url: 'https://mdblist.com/lists/scott/weekend-movies' });

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.mdblistConfigured, false);
    assert.equal(validationResponse.status, 400);
    assert.equal(
      validationResponse.body.message,
      'Configure the MDBList API key in General settings first.'
    );
  });

  it('validates an official list without exposing the API key', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const response = await owner.post('/settings/custom-lists/validate').send({
      url: 'https://mdblist.com/lists/official/movies/justwatch-streaming-charts',
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.body.title,
      'United States Daily Streaming Charts: Movies'
    );
    assert.equal(response.body.itemCount, 2);
    assert.deepEqual(
      response.body.preview.map((item: { tmdbId: number }) => item.tmdbId),
      [100, 200]
    );
    assert.equal(
      JSON.stringify(response.body).includes('configured-secret'),
      false
    );
  });

  it('creates a public list and its enabled dynamic Discover slider', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const response = await owner.post('/settings/custom-lists').send({
      url: 'https://mdblist.com/lists/scott/weekend-movies',
      title: 'Weekend Movies',
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.title, 'Weekend Movies');
    assert.equal(response.body.listType, 'public');
    assert.equal(response.body.discoverSlider.enabled, true);

    const list = await getRepository(CustomList).findOneByOrFail({
      id: response.body.id,
    });
    const slider = await getRepository(DiscoverSlider).findOneByOrFail({
      type: DiscoverSliderType.MDBLIST_CUSTOM_MOVIES,
      data: String(list.id),
    });
    assert.equal(slider.title, 'Weekend Movies');
    assert.equal(slider.isBuiltIn, true);
    assert.equal(slider.enabled, true);
  });

  it('creates an official show list and TV Discover slider', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const response = await owner.post('/settings/custom-lists').send({
      url: 'https://mdblist.com/lists/official/shows/moviemeter',
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.mediaType, 'tv');
    assert.equal(
      response.body.sourceUrl,
      'https://mdblist.com/lists/official/shows/moviemeter'
    );
    const slider = await getRepository(DiscoverSlider).findOneByOrFail({
      type: DiscoverSliderType.MDBLIST_CUSTOM_TV,
      data: String(response.body.id),
    });
    assert.equal(slider.enabled, true);
  });

  it('rejects duplicate lists', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const body = {
      url: 'https://mdblist.com/lists/scott/weekend-movies',
    };
    assert.equal(
      (await owner.post('/settings/custom-lists').send(body)).status,
      201
    );
    assert.equal(
      (await owner.post('/settings/custom-lists').send(body)).status,
      409
    );
  });

  it('rejects non-MDBList hosts before making an upstream request', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const response = await owner.post('/settings/custom-lists/validate').send({
      url: 'https://example.com/lists/scott/weekend-movies',
    });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      'Only URLs from mdblist.com are supported.'
    );
  });

  it('deletes only the selected list and its associated slider', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const created = await owner.post('/settings/custom-lists').send({
      url: 'https://mdblist.com/lists/scott/weekend-movies',
    });
    const listId = created.body.id;

    assert.equal(
      (await owner.delete(`/settings/custom-lists/${listId}`)).status,
      204
    );
    assert.equal(await getRepository(CustomList).countBy({ id: listId }), 0);
    assert.equal(
      await getRepository(DiscoverSlider).countBy({
        type: DiscoverSliderType.MDBLIST_CUSTOM_MOVIES,
        data: String(listId),
      }),
      0
    );
  });

  it('restores managed sliders without duplicating custom lists', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const created = await owner.post('/settings/custom-lists').send({
      url: 'https://mdblist.com/lists/scott/weekend-movies',
    });

    await getRepository(DiscoverSlider).delete({
      type: DiscoverSliderType.MDBLIST_CUSTOM_MOVIES,
      data: String(created.body.id),
    });
    await bootstrapCustomListSliders();
    await bootstrapCustomListSliders();

    const sliders = await getRepository(DiscoverSlider).findBy({
      type: DiscoverSliderType.MDBLIST_CUSTOM_MOVIES,
      data: String(created.body.id),
    });
    assert.equal(sliders.length, 1);
    assert.equal(sliders[0].isBuiltIn, true);
    assert.equal(sliders[0].enabled, true);
  });

  it('requires administrator permission', async () => {
    const user = await loginAs('friend@seerr.dev');
    assert.equal((await user.get('/settings/custom-lists')).status, 403);
  });
});
