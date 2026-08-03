import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isServerOwner } from '@server/lib/serverOwner';

describe('isServerOwner', () => {
  it('encapsulates the established first-user owner convention', () => {
    assert.equal(isServerOwner({ id: 1 }), true);
    assert.equal(isServerOwner({ id: 2 }), false);
    assert.equal(isServerOwner(undefined), false);
  });
});
