import assert from 'node:assert/strict';
import { afterEach, before, describe, it, mock } from 'node:test';

import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import Settings, { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import settingsRoutes from '@server/routes/settings';
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
  it('provides the enabled green default message', () => {
    const defaults = new Settings().main;

    assert.equal(defaults.mobileAnnouncementEnabled, true);
    assert.equal(defaults.mobileAnnouncementColor, 'green');
    assert.equal(defaults.mobileAnnouncementDurationDays, 7);
    assert.ok(defaults.mobileAnnouncementExpiresAt);
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
