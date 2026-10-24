export function describeResponse(response) {
  const body = typeof response.body === 'string' ? response.body : '';
  const errorCode =
    body.match(
      /class=["'][^"']*cf-error-code[^"']*["'][^>]*>\s*(\d{3,4})/i,
    )?.[1] || body.match(/\bError(?:\s+code)?\s*:?\s*(1\d{3})\b/i)?.[1];
  const lower = body.toLowerCase();
  const signals = [
    'worker exceeded resource limits',
    'worker threw exception',
    'too many subrequests',
    'exceeded cpu',
    'out of memory',
    'upstream connect error',
    'no healthy upstream',
    'service unavailable',
    'cypress',
  ].filter((message) => lower.includes(message));
  return {
    status: response.statusCode ?? response.status,
    contentType: response.headers?.['content-type'],
    cloudflareServer: response.headers?.server === 'cloudflare',
    cfRayPresent: typeof response.headers?.['cf-ray'] === 'string',
    bodyKind: typeof response.body,
    bodyLength: body.length,
    cloudflareErrorCode: errorCode || null,
    signals,
    hasApp: body.includes('data-cy="record-catch"'),
    hasLogin: body.includes('google-login-button'),
  };
}

export function diagnosePage(expectedSession) {
  const target = new URL(Cypress.config('baseUrl'));
  const name =
    (target.protocol === 'https:' ? '__Host-' : '') + 'tsuri_session';
  return cy.document({ log: false }).then((doc) => {
    const text = doc.body.textContent;
    const errorCode = doc.querySelector('.cf-error-code')?.textContent?.trim();
    const snapshot = {
      contentType: doc.contentType,
      readyState: doc.readyState,
      homePath: doc.location.pathname === '/',
      hasApp: !!doc.querySelector('[data-cy="record-catch"]'),
      hasLogin: !!doc.querySelector('.google-login-button'),
      hasShell: !!doc.querySelector('.app-shell'),
      bodyChildTags: Array.from(doc.body.children, (node) => node.tagName),
      bodyHidden: doc.body.style.visibility === 'hidden',
      bodyTextLength: text.length,
      cloudflareErrorCode: /^\d{3,4}$/.test(errorCode || '') ? errorCode : null,
      workerResourceLimit: text.includes('Worker exceeded resource limits'),
      workerException: text.includes('Worker threw exception'),
    };
    return cy
      .then(() => {
        if (!Cypress.state('aliases')?.list) return;
        return cy.get('@list.all', { log: false }).then((requests) => {
          snapshot.failedLists = requests
            .filter((request) => request.response?.statusCode >= 400)
            .map((request) => describeResponse(request.response));
        });
      })
      .then(() => cy.getCookie(name, { domain: target.hostname, log: false }))
      .then((cookie) => {
        snapshot.cookiePresent = !!cookie;
        snapshot.cookieMatchesExpected = cookie?.value === expectedSession;
        return cy.request({
          url: '/api/profile',
          failOnStatusCode: false,
          followRedirect: false,
          log: false,
        });
      })
      .then((response) => {
        snapshot.profileStatus = response.status;
        return cy.request({
          url: '/',
          failOnStatusCode: false,
          followRedirect: false,
          log: false,
        });
      })
      .then((response) => {
        snapshot.home = describeResponse(response);
        return cy.task('pageFailureState', snapshot, { log: false });
      });
  });
}
