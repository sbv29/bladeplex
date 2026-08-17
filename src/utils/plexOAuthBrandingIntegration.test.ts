import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const plexOAuth = readFileSync(resolve(__dirname, 'plex.ts'), 'utf8');

describe('Plex OAuth branding', () => {
  it('identifies the application and browser device as BladePlex', () => {
    assert.match(plexOAuth, /'X-Plex-Product': 'BladePlex'/);
    assert.match(
      plexOAuth,
      /'X-Plex-Device-Name': `\$\{browser\.getBrowserName\(\)\} \(BladePlex\)`/
    );
    assert.doesNotMatch(plexOAuth, /X-Plex-(?:Product|Device-Name)'[^\n]*Seerr/);
  });
});
