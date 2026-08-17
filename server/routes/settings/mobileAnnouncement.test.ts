import assert from 'node:assert/strict';
import { afterEach, before, describe, it, mock } from 'node:test';

import MdblistRatingsAPI from '@server/api/mdblist/ratings';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import Settings, { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import settingsRoutes, { MDBLIST_API_KEY_MASK } from '@server/routes/settings';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

let app: Express;
const settings = getSettings();
const originalAnnouncement = {
  mobileAnnouncementEnabled: settings.main.mobileAnnouncementEnabled,
  mobileAnnouncementMessage: settings.main.mobileAnnouncementMessage,
  mobileAnnouncementColor: settings.main.mobileAnnouncementColor,
  mobileAnnouncementRevision: settings.main.mobileAnnouncementRevision,
  mobileAnnouncementDurationDays: settings.main.mobileAnnouncementDurationDays,
  mobileAnnouncementExpiresAt: settings.main.mobileAnnouncementExpiresAt,
};
const originalMdblistApiKey = settings.main.mdblistApiKey;
const originalStatusIndicator = {
  statusIndicatorEnabled: settings.main.statusIndicatorEnabled,
  statusPageUrl: settings.main.statusPageUrl,
  statusIndicatorRevision: settings.main.statusIndicatorRevision,
};

mock.method(settings, 'save', async () => undefined);

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
  testApp.use('/settings', isAuthenticated(Permission.ADMIN), settingsRoutes);
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

afterEach(() => {
  Object.assign(settings.main, originalAnnouncement);
  Object.assign(settings.main, originalStatusIndicator);
  settings.main.mdblistApiKey = originalMdblistApiKey;
});

describe('service status indicator settings', () => {
  it('defaults to the disabled BladePlex status page', () => {
    const defaults = new Settings().main;

    assert.equal(defaults.statusIndicatorEnabled, false);
    assert.equal(defaults.statusPageUrl, 'https://status.sblade.io/');
    assert.equal(defaults.statusIndicatorRevision, 1);
  });

  it('stores and normalizes an Uptime Kuma status page URL', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const response = await owner.post('/settings/main').send({
      statusIndicatorEnabled: true,
      statusPageUrl: 'https://kuma.example/status/home',
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.statusIndicatorEnabled, true);
    assert.equal(
      response.body.statusIndicatorRevision,
      originalStatusIndicator.statusIndicatorRevision + 1
    );
    assert.equal(
      response.body.statusPageUrl,
      'https://kuma.example/status/home'
    );
  });

  it('increments the onboarding revision every time the toggle changes', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const initialRevision = settings.main.statusIndicatorRevision;

    const enabled = await owner.post('/settings/main').send({
      statusIndicatorEnabled: true,
    });
    const disabled = await owner.post('/settings/main').send({
      statusIndicatorEnabled: false,
    });

    assert.equal(enabled.body.statusIndicatorRevision, initialRevision + 1);
    assert.equal(disabled.body.statusIndicatorRevision, initialRevision + 2);
  });

  it('rejects non-HTTP status page URLs', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const response = await owner.post('/settings/main').send({
      statusPageUrl: 'file:///tmp/status',
    });

    assert.equal(response.status, 400);
    assert.equal(
      settings.main.statusPageUrl,
      originalStatusIndicator.statusPageUrl
    );

    const credentialsResponse = await owner.post('/settings/main').send({
      statusPageUrl: 'https://user:password@kuma.example/status/home',
    });
    assert.equal(credentialsResponse.status, 400);
  });
});

describe('MDBList API key settings', () => {
  it('defaults to unconfigured', () => {
    assert.equal(new Settings().main.mdblistApiKey, '');
  });

  it('stores owner updates but returns only a mask', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const response = await owner.post('/settings/main').send({
      mdblistApiKey: '  owner-secret  ',
    });

    assert.equal(response.status, 200);
    assert.equal(settings.main.mdblistApiKey, 'owner-secret');
    assert.equal(response.body.mdblistApiKey, MDBLIST_API_KEY_MASK);
    assert.equal(JSON.stringify(response.body).includes('owner-secret'), false);

    const readResponse = await owner.get('/settings/main');
    assert.equal(readResponse.body.mdblistApiKey, MDBLIST_API_KEY_MASK);
  });

  it('validates and stores an MDBList API key during setup', async () => {
    const getImdbRatings = mock.method(
      MdblistRatingsAPI.prototype,
      'getImdbRatings',
      async () => ({ ratings: [], returnedTmdbIds: new Set(), quota: {} })
    );

    try {
      const owner = await loginAs('admin@seerr.dev');
      const response = await owner
        .post('/settings/main/mdblist/validate')
        .send({ apiKey: ' setup-secret ' });

      assert.equal(response.status, 200);
      assert.equal(response.body.valid, true);
      assert.equal(settings.main.mdblistApiKey, 'setup-secret');
      assert.equal(getImdbRatings.mock.callCount(), 1);
    } finally {
      getImdbRatings.mock.restore();
    }
  });

  it('does not store an MDBList API key when validation fails', async () => {
    const getImdbRatings = mock.method(
      MdblistRatingsAPI.prototype,
      'getImdbRatings',
      async () => {
        throw new Error('Unauthorized');
      }
    );

    try {
      const owner = await loginAs('admin@seerr.dev');
      const response = await owner
        .post('/settings/main/mdblist/validate')
        .send({ apiKey: 'invalid-secret' });

      assert.equal(response.status, 400);
      assert.equal(settings.main.mdblistApiKey, originalMdblistApiKey);
    } finally {
      getImdbRatings.mock.restore();
    }
  });

  it('preserves the stored key when a mask or blank value is saved', async () => {
    settings.main.mdblistApiKey = 'existing-secret';
    const owner = await loginAs('admin@seerr.dev');

    assert.equal(
      (await owner.post('/settings/main').send({ mdblistApiKey: '' })).status,
      200
    );
    assert.equal(settings.main.mdblistApiKey, 'existing-secret');
    assert.equal(
      (
        await owner
          .post('/settings/main')
          .send({ mdblistApiKey: MDBLIST_API_KEY_MASK })
      ).status,
      200
    );
    assert.equal(settings.main.mdblistApiKey, 'existing-secret');
  });

  it('prevents a non-owner administrator from reading or updating the key', async () => {
    settings.main.mdblistApiKey = 'owner-secret';
    const userRepository = getRepository(User);
    const friend = await userRepository.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    friend.permissions = Permission.ADMIN;
    await userRepository.save(friend);

    const nonOwner = await loginAs('friend@seerr.dev');
    const readResponse = await nonOwner.get('/settings/main');
    assert.equal(readResponse.body.mdblistApiKey, undefined);

    const updateResponse = await nonOwner
      .post('/settings/main')
      .send({ mdblistApiKey: 'replacement' });
    assert.equal(updateResponse.status, 403);
    assert.equal(settings.main.mdblistApiKey, 'owner-secret');
  });
});

const loginAs = async (email: string) => {
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;
  try {
    const agent = request.agent(app);
    const response = await agent
      .post('/auth/local')
      .send({ email, password: 'test1234' });
    assert.equal(response.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
};

describe('mobile announcement settings', () => {
  it('provides a disabled green default message', () => {
    const defaults = new Settings().main;

    assert.equal(defaults.mobileAnnouncementEnabled, false);
    assert.equal(defaults.mobileAnnouncementColor, 'green');
    assert.equal(defaults.mobileAnnouncementDurationDays, 7);
    assert.equal(defaults.mobileAnnouncementExpiresAt, null);
    assert.equal(
      defaults.mobileAnnouncementMessage,
      'This is a new release, text me if there are issues'
    );
  });

  it('trims updates and increments the revision when configuration changes', async () => {
    const owner = await loginAs('admin@seerr.dev');
    const previousRevision = settings.main.mobileAnnouncementRevision;
    const response = await owner.post('/settings/main').send({
      mobileAnnouncementEnabled: true,
      mobileAnnouncementMessage: '  Updated announcement  ',
      mobileAnnouncementColor: 'blue',
      mobileAnnouncementDurationDays: 2,
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.body.mobileAnnouncementMessage,
      'Updated announcement'
    );
    assert.equal(response.body.mobileAnnouncementColor, 'blue');
    assert.equal(response.body.mobileAnnouncementDurationDays, 2);
    const expiresIn =
      new Date(response.body.mobileAnnouncementExpiresAt).getTime() -
      Date.now();
    assert.ok(expiresIn > 47 * 60 * 60 * 1000);
    assert.ok(expiresIn <= 48 * 60 * 60 * 1000);
    assert.equal(
      response.body.mobileAnnouncementRevision,
      previousRevision + 1
    );
  });

  it('rejects invalid colors, empty enabled messages, and long messages', async () => {
    const owner = await loginAs('admin@seerr.dev');

    assert.equal(
      (
        await owner.post('/settings/main').send({
          mobileAnnouncementColor: 'chartreuse',
        })
      ).status,
      400
    );
    assert.equal(
      (
        await owner.post('/settings/main').send({
          mobileAnnouncementDurationDays: 3,
        })
      ).status,
      400
    );
    assert.equal(
      (
        await owner.post('/settings/main').send({
          mobileAnnouncementEnabled: true,
          mobileAnnouncementMessage: '   ',
        })
      ).status,
      400
    );
    assert.equal(
      (
        await owner.post('/settings/main').send({
          mobileAnnouncementMessage: 'x'.repeat(201),
        })
      ).status,
      400
    );
  });

  it('prevents a non-owner administrator from modifying the banner', async () => {
    const userRepository = getRepository(User);
    const friend = await userRepository.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    friend.permissions = Permission.ADMIN;
    await userRepository.save(friend);

    const nonOwner = await loginAs('friend@seerr.dev');
    const response = await nonOwner.post('/settings/main').send({
      mobileAnnouncementEnabled: false,
    });

    assert.equal(response.status, 403);
    assert.equal(
      response.body.message,
      'Only the owner can update the mobile announcement.'
    );
  });
});
