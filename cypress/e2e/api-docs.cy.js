describe('OpenAPI仕様の管理', () => {
  it('未認証ではドキュメントと仕様JSONを取得できない', () => {
    cy.clearCookies();
    for (const url of ['/api/docs', '/api/openapi.json']) {
      cy.request({ url, failOnStatusCode: false })
        .its('status')
        .should('equal', 401);
    }
  });

  it('ログインした利用者が同じstaging環境の仕様とAPIを取得できる', () => {
    cy.task('session', 'owner', { log: false }).then((token) => {
      cy.setCookie('__Host-tsuri_session', token, {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        log: false,
      });
    });
    cy.request('/api/docs').then(({ status, headers, body }) => {
      expect(status).to.equal(200);
      expect(headers['content-type']).to.contain('text/html');
      expect(body).to.contain('/api/openapi.json');
      expect(body).to.contain('same-origin');
    });
    cy.request('/api/openapi.json').then(({ body }) => {
      expect(body.openapi).to.equal('3.1.0');
      expect(body.paths['/api/catches'].post.operationId).to.equal(
        'createCatch',
      );
      expect(body.paths['/api/profile'].get.operationId).to.equal('getProfile');
      expect(body.servers).to.deep.equal([{ url: '/' }]);
    });
    cy.request('/api/profile').then(({ status, body }) => {
      expect(status).to.equal(200);
      expect(body.displayName).to.be.a('string');
    });
  });
});
