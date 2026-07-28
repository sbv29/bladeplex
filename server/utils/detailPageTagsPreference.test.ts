import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// The server test runner does not define the client-side @app path alias.
// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {
  DETAIL_PAGE_TAGS_EXPANDED_KEY,
  parseTagsExpandedPreference,
  readTagsExpandedPreference,
  writeTagsExpandedPreference,
} from '../../src/utils/detailPageTagsPreference';

const createStorage = (initialValue: string | null = null) => {
  let value = initialValue;

  return {
    getItem: (key: string) => {
      assert.equal(key, DETAIL_PAGE_TAGS_EXPANDED_KEY);
      return value;
    },
    setItem: (key: string, nextValue: string) => {
      assert.equal(key, DETAIL_PAGE_TAGS_EXPANDED_KEY);
      value = nextValue;
    },
  };
};

describe('detail page tags preference', () => {
  it('defaults to collapsed when no preference exists', () => {
    assert.equal(parseTagsExpandedPreference(null), false);
  });

  it('restores expanded and collapsed preferences', () => {
    assert.equal(parseTagsExpandedPreference('true'), true);
    assert.equal(parseTagsExpandedPreference('false'), false);
  });

  it('treats invalid stored values as collapsed', () => {
    assert.equal(parseTagsExpandedPreference('1'), false);
    assert.equal(parseTagsExpandedPreference('invalid'), false);
  });

  it('uses one shared key when saving and restoring the preference', () => {
    const storage = createStorage();

    writeTagsExpandedPreference(storage, true);
    assert.equal(readTagsExpandedPreference(storage), true);

    writeTagsExpandedPreference(storage, false);
    assert.equal(readTagsExpandedPreference(storage), false);
  });

  it('falls back safely when storage is unavailable', () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
    };

    assert.equal(readTagsExpandedPreference(unavailableStorage), false);
    assert.doesNotThrow(() =>
      writeTagsExpandedPreference(unavailableStorage, true)
    );
  });
});
