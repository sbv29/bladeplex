import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { defaultSliders, DiscoverSliderType } from '@server/constants/discover';

describe('MDBList discovery slider configuration', () => {
  it('is a unique enabled built-in slider in the default layout', () => {
    const matches = defaultSliders.filter(
      (slider) =>
        slider.type ===
        DiscoverSliderType.MDBLIST_JUSTWATCH_STREAMING_CHART_MOVIES
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].isBuiltIn, true);
    assert.equal(matches[0].enabled, true);
    assert.equal(
      new Set(defaultSliders.map((slider) => slider.type)).size,
      defaultSliders.length
    );
  });
});
