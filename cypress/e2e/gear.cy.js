const marker = Cypress.expose('runMarker');
const by = (value) => `[data-cy="${value}"]`;
let catchIds = [];

function login(role = 'owner') {
  return cy.task('session', role, { log: false }).then((token) => {
    const secure = Cypress.config('baseUrl').startsWith('https:');
    cy.setCookie((secure ? '__Host-' : '') + 'tsuri_session', token, {
      secure,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      log: false,
    });
  });
}
function request(method, url, body, failOnStatusCode = true) {
  return cy.request({
    method,
    url,
    body,
    failOnStatusCode,
    headers: { Origin: Cypress.config('baseUrl') },
    log: false,
  });
}
function gear(label, patch = {}) {
  return request('POST', '/api/gear', {
    kind: 'ロッド',
    name: `${marker}-${label}`,
    spec: 'PE 0.8号',
    memo: marker,
    favorite: true,
    ...patch,
  }).then((r) => {
    expect(r.status).to.equal(201);
    return r.body;
  });
}
function createCatch(combinations) {
  return request('POST', '/api/catches', {
    date: '2026-10-19',
    location: `${marker}-gear`,
    fish: [{ species: 'タチウオ', count: 3, length: 80 }],
    memo: marker,
    combinations,
  }).then((r) => {
    expect(r.status).to.equal(201);
    catchIds.push(r.body.id);
    return r.body.id;
  });
}
function visit() {
  cy.intercept('GET', '/api/gear').as('gearList');
  cy.visit('/');
  cy.wait('@gearList').its('response.statusCode').should('equal', 200);
  cy.get(by('nav-gear')).should('be.visible');
}
function combination(item) {
  return {
    setId: null,
    setName: '',
    gear: [item],
    method: 'テンヤ',
    species: ['タチウオ'],
  };
}

describe('所有道具・基本セット・当日の組み合わせ', () => {
  beforeEach(() => {
    catchIds = [];
    login();
  });
  afterEach(() => {
    login();
    for (const id of catchIds)
      request('DELETE', `/api/catches/${id}`, undefined, false)
        .its('status')
        .should('be.oneOf', [200, 404]);
  });
  for (const width of [1280, 390]) {
    it(`道具登録、基本セット、複製、入力保持、保存後の使用履歴（${width}px）`, () => {
      cy.viewport(width, 900);
      visit();
      cy.get(by('nav-gear'))
        .click()
        .should('have.attr', 'aria-current', 'page');
      cy.get(by('new-gear')).click();
      cy.get(by('gear-name')).type(`${marker}-${width}-rod`);
      cy.get(by('gear-spec')).type('PE 0.8号');
      cy.get(by('gear-memo')).type(marker);
      cy.intercept('POST', '/api/gear').as('saveGear');
      cy.get(by('save-gear')).click();
      cy.wait('@saveGear').then(({ response }) => {
        expect(response.statusCode).to.equal(201);
        const item = response.body;
        cy.get(`[data-gear-id="${item.id}"]`).should('contain', item.name);
        cy.contains('button', '基本セット').click();
        cy.get(by('new-gear-set')).click();
        cy.get(by('set-name')).type(`${marker}-${width}-set`);
        cy.get(by('set-form')).within(() => {
          cy.get(by('gear-picker-search')).type(item.name);
          cy.get(by('gear-option')).check();
        });
        cy.intercept('POST', '/api/gear-sets').as('saveSet');
        cy.get(by('save-gear-set')).click();
        cy.wait('@saveSet').then(({ response: setResponse }) => {
          expect(setResponse.statusCode).to.equal(201);
          cy.get(by('nav-records')).click();
          cy.get(by('record-catch')).click();
          cy.get(by('catch-location')).type(`${marker}-${width}-draft`);
          cy.get(by('fish-species')).type('タチウオ');
          cy.get(by('combination-species'))
            .should('be.checked')
            .uncheck()
            .should('not.be.checked')
            .check();
          cy.get(by('combination-set')).select(String(setResponse.body.id));
          cy.get(by('selected-gear')).should('contain', item.name);
          cy.get(by('combination-method')).type('テンヤ');
          cy.contains('button', 'この組み合わせを複製').click();
          cy.get(by('combination-editor'))
            .should('have.length', 2)
            .last()
            .within(() => {
              cy.get(by('combination-method')).clear().type('浮き釣り');
              cy.contains('button', '見つからない道具を追加').click();
              cy.get(by('inline-gear-name')).type(`${marker}-borrowed`);
              cy.contains('label', '今回の記録だけ').find('input').check();
              cy.contains('button', 'この道具を追加').click();
              cy.get(by('selected-gear')).should('contain', '今回だけ');
            });
          cy.get(by('catch-memo')).type(marker);
          cy.contains('button', '道具画面へ（入力を保持）').click();
          cy.get(by('gear-search')).type(`${marker}-${width}`);
          cy.get(by('nav-profile')).click();
          cy.contains('h1', 'マイページ').should('be.visible');
          cy.get(by('nav-gear')).click();
          cy.get(by('gear-search')).should('have.value', `${marker}-${width}`);
          cy.get(by('nav-records')).click();
          cy.get(by('catch-location')).should(
            'have.value',
            `${marker}-${width}-draft`,
          );
          cy.get(by('combination-editor')).should('have.length', 2);
          cy.intercept('POST', '/api/catches').as('saveCatch');
          cy.get(by('save-catch')).click();
          cy.wait('@saveCatch').then(({ response: catchResponse }) => {
            expect(catchResponse.statusCode).to.equal(201);
            const id = catchResponse.body.id;
            catchIds.push(id);
            cy.reload();
            cy.get(`[data-catch-id="${id}"]`).within(() => {
              cy.contains('summary', '使用した道具').click();
              cy.contains('テンヤ').should('be.visible');
              cy.contains('浮き釣り').should('be.visible');
            });
            cy.get(by('nav-gear')).click();
            cy.contains('button', '使用履歴').first().click();
            cy.get(by('history-species')).type('タチウオ');
            cy.get(by('gear-history-card'))
              .filter(`:contains("${item.name}")`)
              .should('have.length.at.least', 2);
            request('GET', '/api/gear').then((r) =>
              expect(
                r.body.some((g) => g.name === `${marker}-borrowed`),
              ).to.equal(false),
            );
          });
        });
      });
    });
  }
  it('使用終了後も履歴を保持し、独立したコピーと基本セットを保存できる', () => {
    gear('history').then((item) => {
      const original = combination(item);
      createCatch([original]).then((id) => {
        request('PUT', `/api/gear/${item.id}`, {
          ...item,
          name: `${marker}-renamed`,
          retired: true,
        });
        visit();
        cy.get(by('nav-gear')).click();
        cy.contains('button', '使用履歴').first().click();
        cy.get(by('gear-history-card'))
          .filter(`:contains("${item.name}")`)
          .first()
          .as('history');
        cy.get('@history')
          .should('contain', item.name)
          .and('contain', 'PE 0.8号');
        cy.get('@history').contains('button', '基本セットとして保存').click();
        cy.get(by('set-name')).clear().type(`${marker}-from-history`);
        cy.get(by('selected-gear')).should('contain', '使用終了');
        cy.intercept('POST', '/api/gear-sets').as('historySet');
        cy.get(by('save-gear-set')).click();
        cy.wait('@historySet').its('response.statusCode').should('equal', 201);
        cy.get('@history').contains('button', '今回の記録へコピー').click();
        cy.get(by('selected-gear')).should('contain', '使用終了');
        cy.get(by('combination-method')).clear().type('投げ釣り');
        request('GET', '/api/catches').then((r) =>
          expect(
            r.body.find((c) => c.id === id).combinations[0].method,
          ).to.equal('テンヤ'),
        );
      });
    });
  });
  (Cypress.expose('hasOtherUser') ? it : it.skip)(
    '他人の所有道具とメモの非公開・直接指定の拒否',
    () => {
      gear('privacy').then((item) => {
        createCatch([combination(item)]).then((id) => {
          login('other');
          request('GET', '/api/gear').then((r) =>
            expect(r.body.some((g) => g.id === item.id)).to.equal(false),
          );
          request('PUT', `/api/gear/${item.id}`, item, false)
            .its('status')
            .should('equal', 404);
          request(
            'POST',
            '/api/gear-sets',
            { name: 'forbidden', gear: [item] },
            false,
          )
            .its('status')
            .should('equal', 403);
          request('GET', '/api/catches').then((r) => {
            const c = r.body.find((c) => c.id === id);
            expect(c.combinations[0].gear[0].name).to.equal(item.name);
            expect(c.combinations[0].gear[0]).not.to.have.property('memo');
          });
        });
      });
    },
  );
});
