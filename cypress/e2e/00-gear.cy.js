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
    it(`道具登録と基本セットの保存（${width}px）`, () => {
      cy.viewport(width, 900);
      visit();
      cy.get(by('nav-gear'))
        .click()
        .should('have.attr', 'aria-current', 'page');
      cy.task('checkpoint', 'gear:management-start');
      cy.get(by('new-gear')).click();
      cy.get(by('gear-name')).type(`${marker}-${width}-rod`);
      cy.get(by('gear-spec')).type('PE 0.8号');
      cy.get(by('gear-memo')).type(marker);
      cy.intercept('POST', '/api/gear').as('saveGear');
      cy.get(by('save-gear')).click();
      cy.wait('@saveGear').then(({ response }) => {
        expect(response.statusCode).to.equal(201);
        const item = response.body;
        cy.task('checkpoint', 'gear:item-saved');
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
          cy.task('checkpoint', 'gear:management-saved');
          cy.reload();
          cy.wait('@gearList').its('response.statusCode').should('equal', 200);
          cy.get(by('nav-gear')).click();
          cy.contains('button', '基本セット').click();
          cy.get(`[data-set-id="${setResponse.body.id}"]`).should(
            'contain',
            item.name,
          );
          cy.get(`[data-set-id="${setResponse.body.id}"]`)
            .contains('button', '編集')
            .click();
          cy.get(by('set-name')).clear().type(`${marker}-${width}-edited-set`);
          cy.intercept('PUT', `/api/gear-sets/${setResponse.body.id}`).as(
            'editSet',
          );
          cy.get(by('save-gear-set')).click();
          cy.wait('@editSet').its('response.statusCode').should('equal', 200);
          cy.reload();
          cy.wait('@gearList');
          cy.get(by('nav-gear')).click();
          cy.contains('button', '基本セット').click();
          cy.get(`[data-set-id="${setResponse.body.id}"]`).should(
            'contain',
            `${marker}-${width}-edited-set`,
          );
        });
      });
    });
    it(`編集ダイアログの下書き保持・保存失敗からの再試行（${width}px）`, () => {
      cy.viewport(width, 700);
      visit();
      cy.get(by('nav-gear')).click();
      cy.get(by('new-gear')).click();
      cy.get(by('gear-form')).should('be.visible');
      cy.get(by('gear-name')).type(`${marker}-${width}-dialog`);
      cy.get(by('close-gear-dialog')).click();
      cy.get(by('gear-form')).should('not.exist');
      cy.get(by('nav-profile')).click();
      cy.get(by('nav-gear')).click();
      cy.get(by('new-gear')).should('contain', '入力を再開').click();
      cy.get(by('gear-name')).should('have.value', `${marker}-${width}-dialog`);
      cy.get(by('gear-name')).type('{esc}');
      cy.get(by('gear-form')).should('not.exist');
      cy.get(by('new-gear')).click();
      // Click the visible backdrop at the screen edge. Selecting the fixed
      // overlay itself makes Cypress test its covered center for visibility.
      cy.get('body').click(1, 1);
      cy.get(by('gear-form')).should('not.exist');
      cy.get(by('new-gear')).click();
      cy.get(by('gear-name')).should('have.value', `${marker}-${width}-dialog`);
      cy.intercept(
        { method: 'POST', url: '/api/gear', times: 1 },
        {
          statusCode: 503,
          body: { error: 'テスト用の保存失敗' },
        },
      ).as('failedSave');
      cy.get(by('save-gear')).click();
      cy.wait('@failedSave');
      cy.get(by('gear-form')).should('contain', 'テスト用の保存失敗');
      cy.get(by('gear-name')).should('have.value', `${marker}-${width}-dialog`);
      cy.intercept('POST', '/api/gear').as('retrySave');
      cy.get(by('save-gear')).click();
      cy.wait('@retrySave').then(({ response }) => {
        expect(response.statusCode).to.equal(201);
        const item = response.body;
        cy.get(by('gear-form')).should('not.exist');
        cy.get(`[data-gear-id="${item.id}"]`)
          .contains('button', '編集')
          .click();
        cy.get(by('gear-name')).clear().type(`${marker}-${width}-edited`);
        cy.intercept('PUT', `/api/gear/${item.id}`).as('editGear');
        cy.get(by('save-gear')).click();
        cy.wait('@editGear').its('response.statusCode').should('equal', 200);
        cy.reload();
        cy.get(by('nav-gear')).click();
        cy.get(`[data-gear-id="${item.id}"]`).should(
          'contain',
          `${marker}-${width}-edited`,
        );
      });
      cy.contains('button', '基本セット').click();
      cy.get(by('new-gear-set')).click();
      cy.get(by('set-name')).type(`${marker}-${width}-set-draft`);
      cy.get(by('close-gear-dialog')).click();
      cy.get(by('new-gear-set')).click();
      cy.get(by('set-name')).should(
        'have.value',
        `${marker}-${width}-set-draft`,
      );
      cy.get(by('set-form')).contains('button', 'キャンセル').click();
      cy.get(by('new-gear-set')).click();
      cy.get(by('set-name')).should('have.value', '');
      cy.get(by('set-form')).contains('button', 'キャンセル').click();
    });
    it(`セットの置き換え確認と組み合わせの折りたたみ（${width}px）`, () => {
      cy.viewport(width, 900);
      gear('replace-' + width).then((item) => {
        request('POST', '/api/gear-sets', {
          name: `${marker}-${width}-replace-set`,
          gear: [item],
          method: '浮き釣り',
        }).then(({ body: set }) => {
          visit();
          cy.get(by('record-catch')).click();
          cy.get(by('fish-species')).type('タチウオ');
          cy.get(by('combination-details')).should('not.be.visible');
          cy.get(by('combination-set')).select(String(set.id));
          cy.get(by('replace-set-dialog')).should('not.exist');
          cy.get(by('combination-overview'))
            .should('contain', item.name)
            .and('contain', 'タチウオ');
          cy.get(by('combination-details-toggle')).click();
          cy.get(by('combination-method')).clear().type('テンヤ');
          cy.get(by('combination-set')).select('');
          cy.get(by('combination-method')).should('have.value', 'テンヤ');
          cy.get(by('combination-set')).select(String(set.id));
          cy.get(by('replace-set-dialog'))
            .should('be.visible')
            .and('contain', set.name);
          cy.get(by('cancel-replace-set')).should('be.focused').click();
          cy.get(by('combination-set')).should('have.value', '');
          cy.get(by('combination-method')).should('have.value', 'テンヤ');
          cy.get(by('combination-set')).select(String(set.id));
          cy.get(by('confirm-replace-set')).click();
          cy.get(by('combination-method')).should('have.value', '浮き釣り');
          cy.get(by('combination-species')).should('be.checked');
          cy.get(by('combination-details-toggle')).click();
          cy.get(by('combination-details')).should('not.be.visible');
          cy.get(by('combination-details-toggle')).click();
          cy.get(by('combination-method')).should('have.value', '浮き釣り');
          cy.get(by('add-combination')).click();
          cy.get(by('combination-editor'))
            .last()
            .within(() => {
              cy.get(by('combination-details-toggle')).should(
                'have.attr',
                'aria-expanded',
                'true',
              );
              cy.get(by('combination-method')).type('投げ釣り');
            });
          cy.get(by('combination-editor'))
            .first()
            .find(by('combination-actions'))
            .click();
          cy.get(by('delete-combination')).click();
          cy.get(by('combination-editor')).should('have.length', 1);
          cy.get(by('combination-details-toggle')).should(
            'have.attr',
            'aria-expanded',
            'true',
          );
          cy.get(by('combination-method')).should('have.value', '投げ釣り');
        });
      });
    });
    it(`組み合わせの複製、入力保持、保存後の使用履歴（${width}px）`, () => {
      cy.viewport(width, 900);
      gear('record-' + width).then((item) => {
        request('POST', '/api/gear-sets', {
          name: `${marker}-${width}-record-set`,
          gear: [item],
        }).then((setResponse) => {
          expect(setResponse.status).to.equal(201);
          visit();
          cy.task('checkpoint', 'gear:record-start');
          cy.get(by('nav-records')).click();
          cy.get(by('record-catch')).click();
          cy.task('checkpoint', 'gear:form-open');
          cy.get(by('catch-location')).type(`${marker}-${width}-draft`);
          cy.get(by('fish-species')).type('タチウオ');
          cy.task('checkpoint', 'gear:fish-entered');
          cy.get(by('combination-details-toggle')).click();
          cy.get(by('combination-species'))
            .scrollIntoView()
            .should('be.checked');
          cy.get(by('combination-species')).uncheck();
          cy.get(by('combination-species')).should('not.be.checked');
          cy.get(by('combination-species')).check();
          cy.task('checkpoint', 'gear:species-toggled');
          cy.get(by('combination-set'))
            .scrollIntoView()
            .select(String(setResponse.body.id));
          cy.task('checkpoint', 'gear:set-selected');
          cy.get(by('selected-gear')).should('contain', item.name);
          cy.get(by('combination-method')).type('テンヤ');
          cy.task('checkpoint', 'gear:method-entered');
          cy.get(by('combination-actions')).scrollIntoView().click();
          cy.get(by('duplicate-combination')).click();
          cy.get(by('duplicate-combination')).should('not.exist');
          cy.task('checkpoint', 'gear:duplicated');
          cy.get(by('combination-editor'))
            .should('have.length', 2)
            .last()
            .within(() => {
              cy.get(by('combination-method')).clear().type('浮き釣り');
              cy.contains('button', '見つからない道具を追加')
                .scrollIntoView()
                .click();
              cy.task('checkpoint', 'gear:inline-open');
              cy.get(by('inline-gear-name'))
                .scrollIntoView()
                .type(`${marker}-borrowed`);
              cy.task('checkpoint', 'gear:inline-name-entered');
              cy.contains('label', '今回の記録だけ')
                .find('input')
                .scrollIntoView()
                .check();
              cy.task('checkpoint', 'gear:temporary-selected');
              cy.contains('button', 'この道具を追加').click();
              cy.get(by('selected-gear')).should('contain', '今回だけ');
            });
          cy.task('checkpoint', 'gear:combinations-ready');
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
          cy.task('checkpoint', 'gear:draft-restored');
          cy.intercept('POST', '/api/catches').as('saveCatch');
          cy.get(by('save-catch')).click();
          cy.wait('@saveCatch').then(({ response: catchResponse }) => {
            expect(catchResponse.statusCode).to.equal(201);
            const id = catchResponse.body.id;
            catchIds.push(id);
            cy.task('checkpoint', 'gear:record-saved');
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
  for (const width of [1280, 390]) {
    it(`釣果の下書きを保持して履歴から基本セットを保存・キャンセル（${width}px）`, () => {
      cy.viewport(width, 900);
      gear('return-' + width).then((item) => {
        createCatch([combination(item)]);
        visit();
        cy.get(by('record-catch')).click();
        cy.get(by('catch-location')).type(`${marker}-${width}-return`);
        cy.get(by('fish-species')).type('タチウオ');
        cy.contains('button', '過去の組み合わせを再利用')
          .scrollIntoView()
          .click();
        const history = () =>
          cy
            .get(by('gear-history-card'))
            .filter(`:contains("${item.name}")`)
            .first();
        history().contains('button', '基本セットとして保存').click();
        cy.get('[role="dialog"]:visible').should('have.length', 1);
        cy.get(by('set-name')).type(`${marker}-${width}-return-set`);
        cy.get(by('set-form')).contains('button', 'キャンセル').click();
        cy.get(by('catch-location')).should(
          'have.value',
          `${marker}-${width}-return`,
        );
        cy.contains('button', '過去の組み合わせを再利用')
          .scrollIntoView()
          .click();
        history().contains('button', '基本セットとして保存').click();
        cy.get(by('set-name')).type(`${marker}-${width}-return-set`);
        cy.intercept('POST', '/api/gear-sets').as('returnSet');
        cy.get(by('save-gear-set')).click();
        cy.wait('@returnSet').then(({ response }) => {
          expect(response.statusCode).to.equal(201);
          cy.get(by('catch-location')).should(
            'have.value',
            `${marker}-${width}-return`,
          );
          cy.get(by('fish-species')).should('have.value', 'タチウオ');
          cy.get('[role="dialog"]:visible').should('have.length', 1);
          request('GET', '/api/gear-sets').then(({ body }) =>
            expect(body.find((s) => s.id === response.body.id).name).to.equal(
              `${marker}-${width}-return-set`,
            ),
          );
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
        cy.get(by('combination-overview')).should('contain', item.name);
        cy.get(by('combination-details-toggle')).click();
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
