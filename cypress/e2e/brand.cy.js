const brand = '[data-cy="brand"]';

function checkBrand() {
  cy.get(brand)
    .should('be.visible')
    .and('contain', 'つりめぐり')
    .and('contain', 'TSURIMEGURI');
  cy.get(`${brand} img`)
    .should('be.visible')
    .and(($img) => {
      expect($img[0].naturalWidth, 'brand image loaded').to.be.greaterThan(0);
    });
  cy.document().then((doc) => {
    expect(
      doc.documentElement.scrollWidth,
      'no horizontal overflow',
    ).to.be.at.most(doc.documentElement.clientWidth);
  });
  cy.title().should('equal', 'つりめぐり | TSURIMEGURI');
}

describe('つりめぐりのブランド表示', () => {
  for (const [width, height] of [
    [1280, 900],
    [375, 812],
  ]) {
    it(`初期APIの失敗を表示し再読み込みで復帰する ${width}px`, () => {
      cy.clearCookies();
      cy.viewport(width, height);
      cy.intercept('GET', '/api/bootstrap', {
        statusCode: 503,
        body: { error: '初期読み込みの障害を再現' },
      }).as('bootstrapFailure');
      cy.visit('/');
      cy.wait('@bootstrapFailure');
      cy.get('[data-cy="app-loading"] [role="alert"]')
        .should('be.visible')
        .and('contain', '読み込みに失敗しました');
      cy.get('[data-cy="record-catch"]').should('not.exist');
      cy.intercept('GET', '/api/bootstrap', (request) => request.continue()).as(
        'bootstrapRecovery',
      );
      cy.contains('button', '再読み込み').click();
      cy.wait('@bootstrapRecovery')
        .its('response.statusCode')
        .should('equal', 401);
      cy.get('.google-login-button')
        .should('be.visible')
        .and('not.have.attr', 'aria-disabled', 'true');
      cy.get('[data-cy="record-catch"]').should('not.exist');
    });
    for (const hour of [12, 22]) {
      it(`未認証ログイン画面 ${width}px ${hour}時`, () => {
        cy.clearCookies();
        cy.viewport(width, height);
        // Set the browser's clock before app scripts execute, including hydration.
        // Avoid cy.clock across navigations: the clock may be restored on reload.
        const fixedTime = new Date(2026, 9, 12, hour).getTime();
        cy.visit('/', {
          onBeforeLoad(win) {
            const NativeDate = win.Date;
            win.Date = class FixedDate extends NativeDate {
              constructor(...args) {
                super(...(args.length ? args : [fixedTime]));
              }
              static now() {
                return fixedTime;
              }
            };
          },
        });
        cy.get(hour === 12 ? '.login-day' : '.login-night').should('exist');
        checkBrand();
        cy.get('.login-art')
          .should('be.visible')
          .and(($img) => {
            expect($img[0].naturalWidth, 'artwork loaded').to.be.greaterThan(0);
            expect($img[0].currentSrc).to.include('/images/optimized/login-');
          });
        cy.get('.google-login-button')
          .should('be.visible')
          .and('have.attr', 'href', '/api/auth/google');
        cy.get('[data-cy="guest-entry"]').should('not.exist');
        cy.get('meta[property="og:site_name"]').should(
          'have.attr',
          'content',
          'つりめぐり',
        );
        cy.get('link[rel="icon"]').should('have.attr', 'href', '/favicon.svg');
      });
    }
    it(`旧ゲストURLもログイン必須 ${width}px`, () => {
      cy.clearCookies();
      cy.viewport(width, height);
      cy.visit('/?guest=1');
      cy.get('.google-login-button')
        .should('be.visible')
        .and('have.attr', 'href', '/api/auth/google');
      cy.get('[data-cy="guest-entry"]').should('not.exist');
      cy.get('[data-cy="guest-samples"]').should('not.exist');
      for (const url of [
        '/api/catches',
        '/api/catches?guest=1',
        '/api/photos/1',
      ]) {
        cy.request({ url, failOnStatusCode: false, log: false })
          .its('status')
          .should('equal', 401);
      }
    });
    it(`認証後ヘッダー ${width}px`, () => {
      cy.viewport(width, height);
      cy.task('session', 'owner', { log: false }).then((token) => {
        const secure = Cypress.config('baseUrl').startsWith('https:');
        cy.setCookie((secure ? '__Host-' : '') + 'tsuri_session', token, {
          secure,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          log: false,
        });
      });
      cy.intercept('GET', '/api/catches').as('list');
      cy.visit('/');
      cy.wait('@list').its('response.statusCode').should('equal', 200);
      checkBrand();
      cy.get('.seasonal-hero-art img')
        .should('be.visible')
        .and(($img) => {
          expect(
            $img[0].naturalWidth,
            'seasonal artwork loaded',
          ).to.be.greaterThan(0);
          expect($img[0].currentSrc).to.include('/images/optimized/hero-');
        });
      cy.get('[data-cy="record-catch"]').should('be.visible');
    });
  }
});
