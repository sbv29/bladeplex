const announcementSettings = {
  mobileAnnouncementEnabled: true,
  mobileAnnouncementMessage: 'A configured mobile announcement',
  mobileAnnouncementColor: 'purple',
  mobileAnnouncementRevision: 41,
  mobileAnnouncementDurationDays: 7,
  mobileAnnouncementExpiresAt: '2099-01-01T00:00:00.000Z',
};

describe('Mobile announcement', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.clearLocalStorage('seerr.mobileAnnouncementDismissedRevision');
  });

  const visitWithSettings = (
    overrides: Partial<typeof announcementSettings> = {},
    viewport: Cypress.ViewportPreset | [number, number] = [390, 844]
  ) => {
    cy.intercept('GET', '/api/v1/settings/public', (request) => {
      request.continue((response) => {
        response.body = {
          ...response.body,
          ...announcementSettings,
          ...overrides,
        };
      });
    }).as('publicSettings');

    if (Array.isArray(viewport)) {
      cy.viewport(viewport[0], viewport[1]);
    } else {
      cy.viewport(viewport);
    }
    cy.visit('/');
    cy.wait('@publicSettings');
  };

  it('shows configured text and color above mobile navigation', () => {
    const longMessage = 'A long mobile announcement '.repeat(12);
    visitWithSettings({ mobileAnnouncementMessage: longMessage });

    cy.get('[data-testid=mobile-announcement]')
      .should('be.visible')
      .and('contain.text', longMessage.trim())
      .and('have.class', 'bg-purple-700');
    cy.get('[aria-label="Dismiss announcement"]').should('be.visible');
    cy.get('[data-testid=mobile-announcement]').then(($banner) => {
      cy.get('[data-testid=mobile-navigation]').then(($navigation) => {
        expect($banner[0].getBoundingClientRect().bottom).to.be.at.most(
          $navigation[0].getBoundingClientRect().top
        );
      });
    });
  });

  it('persists dismissal and shows a changed revision', () => {
    visitWithSettings();
    cy.get('[aria-label="Dismiss announcement"]').click();
    cy.get('[data-testid=mobile-announcement]')
      .parent()
      .should('have.class', 'opacity-0');
    cy.get('[data-testid=mobile-announcement]').should('not.exist');

    cy.reload();
    cy.wait('@publicSettings');
    cy.get('[data-testid=mobile-announcement]').should('not.exist');

    cy.intercept('GET', '/api/v1/settings/public', (request) => {
      request.continue((response) => {
        response.body = {
          ...response.body,
          ...announcementSettings,
          mobileAnnouncementRevision: 42,
        };
      });
    }).as('updatedPublicSettings');
    cy.reload();
    cy.wait('@updatedPublicSettings');
    cy.get('[data-testid=mobile-announcement]').should('be.visible');
  });

  it('does not display when disabled or on desktop', () => {
    visitWithSettings({ mobileAnnouncementEnabled: false });
    cy.get('[data-testid=mobile-announcement]').should('not.exist');

    visitWithSettings({}, 'macbook-13');
    cy.get('[data-testid=mobile-announcement]').should('not.be.visible');
  });

  it('reduces opacity while scrolling and hides after expiration', () => {
    visitWithSettings();
    cy.window().trigger('scroll');
    cy.get('[data-testid=mobile-announcement]')
      .parent()
      .should('have.class', 'opacity-50');
    cy.wait(200);
    cy.get('[data-testid=mobile-announcement]')
      .parent()
      .should('have.class', 'opacity-100');

    visitWithSettings({
      mobileAnnouncementExpiresAt: '2020-01-01T00:00:00.000Z',
    });
    cy.get('[data-testid=mobile-announcement]').should('not.exist');
  });
});
