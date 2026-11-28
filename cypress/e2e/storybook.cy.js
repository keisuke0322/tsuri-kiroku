describe('stagingの公開Storybook', () => {
  let apiRequests;

  beforeEach(() => {
    apiRequests = [];
    cy.clearCookies();
    cy.intercept('/api/**', (request) => {
      apiRequests.push(request.url);
      request.reply({
        statusCode: 500,
        body: { error: 'Storybook must not call application APIs' },
      });
    });
  });

  afterEach(() => {
    cy.then(() =>
      expect(apiRequests, 'application API requests').to.deep.equal([]),
    );
  });

  for (const width of [1280, 390]) {
    it(`${width}pxで入力・日付選択・ダイアログを操作できる`, () => {
      cy.viewport(width, 900);
      cy.visit('/storybook/iframe.html?id=button--app-actions&viewMode=story');
      cy.contains('button', '釣果を記録')
        .should('have.css', 'background-color', 'rgb(8, 123, 135)')
        .and('have.css', 'height', '46px');

      cy.visit(
        '/storybook/iframe.html?id=method-field--default&viewMode=story',
      );
      cy.get('#storybook-root input[data-cy="combination-method"]')
        .should('have.length', 1)
        .type('サビキ');
      cy.get('[role="option"]')
        .contains('サビキ')
        .should('have.css', 'min-height', '44px')
        .click();
      cy.get('#storybook-root input[data-cy="combination-method"]').should(
        'have.value',
        'サビキ',
      );

      cy.visit(
        '/storybook/iframe.html?id=catch-date-field--default&viewMode=story',
      );
      cy.get('[data-cy="catch-date-trigger"]').click();
      cy.get('[data-cy="confirm-catch-date"]').click();
      cy.get('[data-cy="catch-date-value"]').should('have.text', '2026/11/18');
      cy.get('[data-cy="confirm-catch-date"]').should('not.exist');

      cy.visit('/storybook/iframe.html?id=dialog--default&viewMode=story');
      cy.contains('button', '詳細を開く').click();
      cy.get('[role="dialog"]')
        .should('be.visible')
        .and('contain', '釣行の詳細');
      cy.focused().type('{esc}');
      cy.get('[role="dialog"]').should('not.exist');
      cy.contains('button', '詳細を開く').should('have.focus');
    });
  }

  it('DocsのURLを直接開き、再読み込みできる', () => {
    cy.visit('/storybook/?path=/docs/button--docs');
    const docs = () =>
      cy
        .get('#storybook-preview-iframe')
        .its('0.contentDocument.body')
        .should('not.be.empty');
    docs().should('contain', '主要操作はdefault');
    cy.reload();
    docs().should('contain', '主要操作はdefault');
  });
});
