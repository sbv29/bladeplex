const chartTitle = 'United States Daily Streaming Charts: Movies';
const chartApi = '/api/v1/discover/mdblist/justwatch-streaming-charts/movies*';
const chartRoute = '/discover/movies/mdblist-streaming';

const movieResult = {
  id: 550,
  mediaType: 'movie',
  title: 'MDBList Test Movie',
  originalTitle: 'MDBList Test Movie',
  overview: 'A native BladePlex movie card.',
  posterPath: null,
  backdropPath: null,
  voteAverage: 8,
  voteCount: 100,
  releaseDate: '1999-10-15',
  genreIds: [],
  mdblistRank: 1,
};

const chartResponse = {
  page: 1,
  totalPages: 1,
  totalResults: 1,
  results: [movieResult],
};

describe('MDBList Discover section', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('links the keyboard-accessible slider heading to the native grid', () => {
    cy.intercept('GET', '/api/v1/discover/**', {
      page: 1,
      totalPages: 1,
      totalResults: 0,
      results: [],
    });
    cy.intercept('GET', chartApi, chartResponse).as('getMdblistChart');

    cy.visit('/');
    cy.wait('@getMdblistChart');

    cy.contains('.slider-header a', chartTitle)
      .should('have.attr', 'href', chartRoute)
      .focus()
      .should('have.focus');
  });

  it('keeps the native destination through Discover customization', () => {
    cy.intercept('GET', '/api/v1/discover/**', {
      page: 1,
      totalPages: 1,
      totalResults: 0,
      results: [],
    });
    cy.intercept('GET', chartApi, chartResponse).as('getMdblistChart');

    cy.visit('/');
    cy.wait('@getMdblistChart');
    cy.get('[data-testid=discover-start-editing]').click();

    cy.contains('[data-testid=discover-slider-edit-mode]', chartTitle)
      .as('mdblistSlider')
      .find('[role="checkbox"]')
      .click()
      .click();

    cy.contains('button', 'Stop Editing').click();
    cy.contains('.slider-header a', chartTitle).should(
      'have.attr',
      'href',
      chartRoute
    );
  });

  it('renders the native grid, title, and movie detail link', () => {
    cy.intercept('GET', chartApi, chartResponse).as('getMdblistChartPage');

    cy.visit(chartRoute);
    cy.wait('@getMdblistChartPage');

    cy.title().should('contain', chartTitle);
    cy.get('[data-testid=page-header]').should('contain', chartTitle);
    cy.get('.cards-vertical')
      .find('[data-testid=title-card]')
      .should('have.length', 1)
      .trigger('mouseover')
      .find('a[href="/movie/550"]')
      .should('exist');
    cy.get('html').invoke('prop', 'outerHTML').should('not.contain', 'apikey=');
    cy.get('html')
      .invoke('prop', 'outerHTML')
      .should('not.contain', 'mdblistApiKey');
  });

  it('renders the native empty state', () => {
    cy.intercept('GET', chartApi, {
      page: 1,
      totalPages: 1,
      totalResults: 0,
      results: [],
    }).as('getEmptyMdblistChart');

    cy.visit(chartRoute);
    cy.wait('@getEmptyMdblistChart');
    cy.contains('No results.').should('be.visible');
  });

  it('omits the optional homepage slider when the provider is empty', () => {
    cy.intercept('GET', '/api/v1/discover/**', {
      page: 1,
      totalPages: 1,
      totalResults: 0,
      results: [],
    });
    cy.intercept('GET', chartApi, {
      page: 1,
      totalPages: 1,
      totalResults: 0,
      results: [],
    }).as('getEmptyMdblistSlider');

    cy.visit('/');
    cy.wait('@getEmptyMdblistSlider');
    cy.contains('.slider-header', chartTitle).should('not.exist');
  });

  it('renders a configured custom list with the native full-page grid', () => {
    const customTitle = 'Weekend Movies';
    cy.intercept('GET', '/api/v1/discover/mdblist/lists/42/movies*', {
      ...chartResponse,
      title: customTitle,
    }).as('getCustomList');

    cy.visit('/discover/movies/mdblist/42');
    cy.wait('@getCustomList');

    cy.title().should('contain', customTitle);
    cy.get('[data-testid=page-header]').should('contain', customTitle);
    cy.get('[data-testid=title-card]')
      .should('have.length', 1)
      .trigger('mouseover')
      .find('a[href="/movie/550"]')
      .should('exist');
  });

  it('validates and adds a public list from administrator settings', () => {
    cy.intercept('GET', '/api/v1/settings/custom-lists', {
      mdblistConfigured: true,
      items: [],
    }).as('getCustomLists');
    cy.intercept('POST', '/api/v1/settings/custom-lists/validate', {
      canonicalUrl: 'https://mdblist.com/lists/scott/weekend-movies',
      listType: 'public',
      title: 'Weekend Movies',
      providerTitle: 'Weekend Movies',
      itemCount: 2,
      preview: [
        { rank: 1, title: 'First Movie', year: 2026, tmdbId: 100 },
        { rank: 2, title: 'Second Movie', year: 2025, tmdbId: 200 },
      ],
    }).as('validateCustomList');
    cy.intercept('POST', '/api/v1/settings/custom-lists', {
      statusCode: 201,
      body: {},
    }).as('addCustomList');

    cy.visit('/settings/custom-lists');
    cy.wait('@getCustomLists');
    cy.get('#customListUrl').type(
      'https://mdblist.com/lists/scott/weekend-movies'
    );
    cy.contains('button', 'Validate List').click();
    cy.wait('@validateCustomList');
    cy.contains('List Preview: Weekend Movies').should('be.visible');
    cy.contains('First Movie (2026)').should('be.visible');
    cy.contains('button', 'Add to Discover').click();
    cy.wait('@addCustomList').its('request.body').should('deep.include', {
      url: 'https://mdblist.com/lists/scott/weekend-movies',
    });
  });

  it('confirms custom-list deletion in a responsive modal', () => {
    const customList = {
      id: 42,
      title: 'Weekend Movies',
      sourceUrl: 'https://mdblist.com/lists/scott/weekend-movies',
      listType: 'public',
      itemCount: 20,
      discoverSlider: { id: 24, enabled: true, order: 14 },
    };
    cy.intercept('GET', '/api/v1/settings/custom-lists', {
      mdblistConfigured: true,
      items: [customList],
    }).as('getCustomLists');
    cy.intercept('DELETE', '/api/v1/settings/custom-lists/42', {
      statusCode: 204,
    }).as('deleteCustomList');

    cy.visit('/settings/custom-lists');
    cy.wait('@getCustomLists');
    cy.get('button[aria-label="Delete Weekend Movies"]').click();
    cy.get('[role="dialog"]')
      .should('be.visible')
      .and('contain', 'Delete Custom List')
      .and('contain', 'Are you sure you want to delete “Weekend Movies”');
    cy.get('[data-testid="modal-cancel-button"]').click();
    cy.get('[role="dialog"]').should('not.exist');

    cy.get('button[aria-label="Delete Weekend Movies"]').click();
    cy.get('[data-testid="modal-ok-button"]').click();
    cy.wait('@deleteCustomList');
    cy.get('[role="dialog"]').should('not.exist');
  });
});
