describe('Login Page', () => {
  it('shows Plex first and reveals local sign-in on request', () => {
    cy.visit('/login');

    cy.get('[data-testid=plex-login-button]').should('be.visible');
    cy.get('[data-testid=email]').should('not.exist');
    cy.get('[data-testid=local-login-toggle]')
      .should('have.attr', 'aria-expanded', 'false')
      .click()
      .should('have.attr', 'aria-expanded', 'true');
    cy.get('[data-testid=email]').should('be.visible').and('be.focused');
  });

  it('succesfully logs in as an admin', () => {
    cy.loginAsAdmin();
    cy.visit('/');
    cy.contains('Trending');
  });

  it('succesfully logs in as a local user', () => {
    cy.loginAsUser();
    cy.visit('/');
    cy.contains('Trending');
  });
});
