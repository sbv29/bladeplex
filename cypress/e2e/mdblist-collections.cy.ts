const collection = {
  id: 42,
  title: 'X-Men Universe',
  itemCount: 12,
  selectedArtworkTmdbId: 550,
  selectedArtworkPosterPath: '/poster.jpg',
};

const movie = {
  id: 550,
  mediaType: 'movie',
  title: 'Collection Movie',
  originalTitle: 'Collection Movie',
  overview: '',
  posterPath: null,
  backdropPath: null,
  voteAverage: 8,
  voteCount: 100,
  popularity: 10,
  releaseDate: '2020-01-01',
  genreIds: [28],
  adult: false,
  video: false,
  originalLanguage: 'en',
  mdblistRank: 1,
};

describe('MDBList Collections', () => {
  beforeEach(() => cy.loginAsAdmin());

  it('renders one native collection row and links by stored ID', () => {
    cy.intercept('GET', '/api/v1/settings/discover', [
      { id: 99, type: 27, order: 99, enabled: true, isBuiltIn: true },
    ]);
    cy.intercept('GET', '/api/v1/discover/mdblist/collections', [collection]);
    cy.visit('/');
    cy.contains('MDBList Collections').should('be.visible');
    cy.contains('a', collection.title).should(
      'have.attr',
      'href',
      '/discover/movies/mdblist/42'
    );
  });

  it('keeps Shuffle state in the URL and renders native movie cards', () => {
    cy.intercept('GET', '/api/v1/discover/mdblist/collections/42/movies*', {
      page: 1,
      totalPages: 1,
      totalResults: 1,
      title: collection.title,
      results: [movie],
    });
    cy.visit('/discover/movies/mdblist/42');
    cy.contains('button', 'Shuffle').click();
    cy.location('search')
      .should('include', 'sortBy=random')
      .and('include', 'seed=');
    cy.get('.cards-vertical')
      .find('[data-testid=title-card]')
      .should('have.length', 1);
  });
});
