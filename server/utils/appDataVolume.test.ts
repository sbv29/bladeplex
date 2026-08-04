import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPathMounted } from './appDataVolume';

describe('application data volume detection', () => {
  it('detects an exact config mount', () => {
    const mountInfo =
      '146 132 0:99 / /app/config rw,relatime - ext4 /dev/sda rw';

    assert.equal(isPathMounted('/app/config', mountInfo), true);
  });

  it('does not mistake a parent or child mount for the config mount', () => {
    const mountInfo = [
      '145 132 0:98 / /app rw,relatime - overlay overlay rw',
      '147 132 0:100 / /app/config/cache rw,relatime - tmpfs tmpfs rw',
    ].join('\n');

    assert.equal(isPathMounted('/app/config', mountInfo), false);
  });

  it('decodes escaped mount paths', () => {
    const mountInfo =
      '146 132 0:99 / /app/custom\\040config rw,relatime - ext4 /dev/sda rw';

    assert.equal(isPathMounted('/app/custom config', mountInfo), true);
  });
});
