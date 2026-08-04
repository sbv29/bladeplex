import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { defaultSliders, DiscoverSliderType } from '@server/constants/discover';

describe('MDBList discovery slider configuration', () => {
  it('does not force the legacy streaming chart into the default layout', () => {
    const matches = defaultSliders.filter(
      (slider) =>
        slider.type ===
        DiscoverSliderType.MDBLIST_JUSTWATCH_STREAMING_CHART_MOVIES
    );

    assert.equal(matches.length, 0);
    assert.equal(
      new Set(defaultSliders.map((slider) => slider.type)).size,
      defaultSliders.length
    );
  });

  it('uses the BladePlex default Discover layout', () => {
    const enabledTypes = defaultSliders
      .filter((slider) => slider.enabled)
      .sort((left, right) => Number(left.order) - Number(right.order))
      .map((slider) => slider.type);

    assert.deepEqual(enabledTypes, [
      DiscoverSliderType.RECENT_REQUESTS,
      DiscoverSliderType.RECENTLY_ADDED,
      DiscoverSliderType.MDBLIST_COLLECTIONS,
      DiscoverSliderType.TRENDING,
      DiscoverSliderType.UPCOMING_MOVIES,
      DiscoverSliderType.POPULAR_TV,
      DiscoverSliderType.UPCOMING_TV,
      DiscoverSliderType.MOVIE_GENRES,
      DiscoverSliderType.TV_GENRES,
      DiscoverSliderType.NETWORKS,
    ]);
  });
});
