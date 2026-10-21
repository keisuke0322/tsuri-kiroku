describe('stagingの稼働情報', () => {
  it('ログイン不要で安全な識別情報を取得でき、再取得でも稼働版が一致する', () => {
    cy.clearCookies();
    cy.request('/api/version').then(({ status, headers, body }) => {
      expect(status).to.equal(200);
      expect(headers['cache-control']).to.contain('no-store');
      expect(body.environment).to.equal('staging');
      expect(body.version).to.equal(null);
      expect(body.sha).to.match(/^[a-f0-9]{40}$/);
      expect(body.runId).to.match(/^\d+$/);
      expect(body.runAttempt).to.match(/^\d+$/);
      expect(body.cloudflareVersionId).to.match(/^[a-f0-9-]{36}$/);
      expect(body).to.have.all.keys(
        'environment',
        'sha',
        'version',
        'runId',
        'runAttempt',
        'builtAt',
        'cloudflareVersionId',
        'deployedAt',
      );
      cy.request('/api/version').its('body').should('deep.equal', body);
    });
  });
});
