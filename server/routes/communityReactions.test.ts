import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { CommunityReactionValue } from '@server/constants/communityReaction';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { CommunityReaction } from '@server/entity/CommunityReaction';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import communityReactionRoutes from './communityReactions';

let app: Express;

function createApp() {
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
  testApp.use('/community-reactions', communityReactionRoutes);
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
}

before(() => {
  app = createApp();
});

setupTestDb();

async function loginAs(email: string) {
  const settings = getSettings();
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;
  try {
    const agent = request.agent(app);
    const response = await agent
      .post('/auth/local')
      .send({ email, password: 'test1234' });
    assert.strictEqual(response.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
}

describe('community reactions', () => {
  it('allows an authenticated user to like a movie', async () => {
    const agent = await loginAs('friend@seerr.dev');
    const response = await agent
      .put('/community-reactions/movie/101')
      .send({ reaction: CommunityReactionValue.LIKE });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.likeCount, 1);
    assert.strictEqual(
      response.body.currentUserReaction,
      CommunityReactionValue.LIKE
    );
  });

  it('allows an authenticated user to dislike a TV series', async () => {
    const agent = await loginAs('friend@seerr.dev');
    const response = await agent
      .put('/community-reactions/tv/202')
      .send({ reaction: CommunityReactionValue.DISLIKE });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.dislikeCount, 1);
  });

  it('switches from like to dislike without creating a duplicate', async () => {
    const agent = await loginAs('friend@seerr.dev');
    await agent
      .put('/community-reactions/movie/303')
      .send({ reaction: CommunityReactionValue.LIKE });
    const response = await agent
      .put('/community-reactions/movie/303')
      .send({ reaction: CommunityReactionValue.DISLIKE });

    assert.strictEqual(response.body.likeCount, 0);
    assert.strictEqual(response.body.dislikeCount, 1);
    assert.strictEqual(
      await getRepository(CommunityReaction).countBy({
        mediaType: MediaType.MOVIE,
        tmdbId: 303,
      }),
      1
    );
  });

  it('removes the current user reaction', async () => {
    const agent = await loginAs('friend@seerr.dev');
    await agent
      .put('/community-reactions/movie/404')
      .send({ reaction: CommunityReactionValue.LIKE });
    const response = await agent.delete('/community-reactions/movie/404');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.likeCount, 0);
    assert.strictEqual(response.body.currentUserReaction, null);
  });

  it('keeps movie and TV reactions separate for the same TMDB ID', async () => {
    const agent = await loginAs('friend@seerr.dev');
    await agent
      .put('/community-reactions/movie/505')
      .send({ reaction: CommunityReactionValue.LIKE });
    await agent
      .put('/community-reactions/tv/505')
      .send({ reaction: CommunityReactionValue.DISLIKE });

    const movie = await agent.get('/community-reactions/movie/505');
    const tv = await agent.get('/community-reactions/tv/505');
    assert.deepStrictEqual(
      [movie.body.likeCount, movie.body.dislikeCount],
      [1, 0]
    );
    assert.deepStrictEqual([tv.body.likeCount, tv.body.dislikeCount], [0, 1]);
  });

  it('rejects unauthenticated reaction modifications', async () => {
    const response = await request(app)
      .put('/community-reactions/movie/606')
      .send({ reaction: CommunityReactionValue.LIKE });
    assert.strictEqual(response.status, 401);
  });

  it('returns correct totals, current reaction, and public-only users', async () => {
    const friend = await loginAs('friend@seerr.dev');
    const admin = await loginAs('admin@seerr.dev');
    await friend
      .put('/community-reactions/movie/707')
      .send({ reaction: CommunityReactionValue.LIKE });
    await admin
      .put('/community-reactions/movie/707')
      .send({ reaction: CommunityReactionValue.DISLIKE });

    const response = await friend.get('/community-reactions/movie/707');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.likeCount, 1);
    assert.strictEqual(response.body.dislikeCount, 1);
    assert.strictEqual(
      response.body.currentUserReaction,
      CommunityReactionValue.LIKE
    );
    assert.deepStrictEqual(Object.keys(response.body.likedBy[0]).sort(), [
      'avatar',
      'displayName',
      'id',
    ]);
    const serializedUsers = JSON.stringify([
      ...response.body.likedBy,
      ...response.body.dislikedBy,
    ]);
    assert.ok(!serializedUsers.includes('email'));
    assert.ok(!serializedUsers.includes('permissions'));
    assert.ok(!serializedUsers.includes('plexToken'));
  });
});
