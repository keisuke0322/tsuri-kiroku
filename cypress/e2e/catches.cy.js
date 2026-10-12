const marker = Cypress.expose('runMarker');
const by = value => `[data-cy="${value}"]`;
let createdIds = [];

function login(role = 'owner') {
  return cy.task('session', role, {log: false}).then(token => {
    const secure = Cypress.config('baseUrl').startsWith('https:');
    cy.setCookie((secure ? '__Host-' : '') + 'tsuri_session', token,
      {secure, httpOnly: true, sameSite: 'lax', path: '/', log: false});
  });
}
function payload(label) {
  return {date: '2026-10-08', location: `${marker}-${label}`, fish: [{species: 'アジ', count: 2, length: 20}], method: 'サビキ', memo: marker};
}
function create(label) {
  return cy.request({method: 'POST', url: '/api/catches', body: payload(label),
    headers: {Origin: Cypress.config('baseUrl')}, log: false}).then(response => {
    expect(response.status).to.equal(201);
    const id = response.body.id;
    expect(id).to.be.a('number');
    createdIds.push(id);
    return id;
  });
}
function card(id) { return cy.get(`[data-cy="catch-card"][data-catch-id="${id}"]`); }
function visit() {
  cy.intercept('GET', '/api/catches').as('list');
  cy.visit('/');
  cy.wait('@list').its('response.statusCode').should('equal', 200);
}
function reload() { cy.reload(); return cy.wait('@list').then(interception => {
  expect(interception.response.statusCode).to.equal(200);
  return interception;
}); }

describe('釣果の主要操作', () => {
  before(() => { expect(marker, 'run marker').to.match(/^E2E-[a-f0-9-]{36}$/); });
  beforeEach(() => { createdIds = []; login(); });
  afterEach(() => {
    login();
    for (const id of createdIds) cy.request({method: 'DELETE', url: `/api/catches/${id}`,
      headers: {Origin: Cypress.config('baseUrl')}, failOnStatusCode: false, log: false})
      .its('status').should('be.oneOf', [200, 404]);
  });

  it('認証済みユーザーとして一覧を開ける', () => {
    visit();
    cy.get(by('record-catch')).should('be.visible');
    cy.get(by('my-catches')).click();
    cy.contains('釣行一覧').should('be.visible');
  });

  it('釣果を登録し、再読み込み後も保存内容を確認できる', () => {
    visit();
    cy.get(by('record-catch')).click();
    cy.get(by('catch-location')).type(`${marker}-register`);
    cy.get(by('fish-species')).type('アジ');
    cy.get(by('fish-count')).clear().type('2');
    cy.get(by('fish-length')).type('20');
    cy.get(by('catch-memo')).type(marker);
    cy.intercept('POST', '/api/catches').as('save');
    cy.get(by('save-catch')).click();
    cy.wait('@save').then(({response}) => {
      expect(response.statusCode).to.equal(201);
      const id = response.body.id;
      createdIds.push(id);
      cy.wait('@list').its('response.statusCode').should('equal', 200);
      card(id).should('contain', `${marker}-register`).and('contain', 'アジ').and('contain', '2 匹').and('contain', '20 cm');
      reload();
      card(id).should('contain', `${marker}-register`).and('contain', 'アジ').and('contain', '2 匹').and('contain', '20 cm');
    });
  });

  for (const width of [1280, 390, 414]) it(`魚種ごとのレシピ検索とポップアップ操作（${width}px）`, () => {
    cy.viewport(width, 844);
    const fishNames = ['アジ', '太刀魚', 'とても長い名前の魚（地方名・別名を含む）'];
    const body = {...payload(`recipes-${width}`), fish: fishNames.map(species => ({species, count: 1, length: 12.5}))};
    cy.request({method: 'POST', url: '/api/catches', body,
      headers: {Origin: Cypress.config('baseUrl')}, log: false}).then(response => {
      expect(response.status).to.equal(201);
      const id = response.body.id; createdIds.push(id);
      visit();
      reload();
      card(id).find(by('recipe-trigger')).should('have.length', 3);
      if (width <= 650) card(id).then($card => {
        const main = $card[0].querySelector('.card-main').getBoundingClientRect();
        const actions = $card[0].querySelector('.card-actions').getBoundingClientRect();
        expect(actions.top).to.be.at.least(main.bottom);
        $card[0].querySelectorAll('.catch-title').forEach(row => {
          const fish = row.querySelector('h3').getBoundingClientRect();
          const recipe = row.querySelector('.recipe-trigger').getBoundingClientRect();
          expect(recipe.top).to.be.lessThan(fish.bottom);
          expect(recipe.bottom).to.be.greaterThan(fish.top);
          expect(recipe.right).to.be.at.most(main.right);
        });
      });
      for (const name of fishNames) {
        const selector = `${by('recipe-trigger')}[aria-label="${name}のレシピを探す"]`;
        card(id).find(selector).scrollIntoView().click().should('have.attr', 'aria-expanded', 'true');
        cy.get(by('recipe-popover')).should('be.visible').and('contain', `${name}のレシピ`).then($popup => {
          const rect = $popup[0].getBoundingClientRect();
          expect(rect.left).to.be.at.least(0);
          expect(rect.right).to.be.at.most(width);
        });
        const query = encodeURIComponent(`釣り ${name}`);
        const urls = [`https://recipe.rakuten.co.jp/search/${query}/`, `https://cookpad.com/jp/search/${query}`];
        cy.get(by('recipe-link')).should('have.length', 2).each(($link, index) => {
          expect($link.attr('href')).to.equal(urls[index]);
          expect($link.attr('target')).to.equal('_blank');
          expect($link.attr('rel')).to.equal('noopener noreferrer');
        });
        cy.get(by('recipe-link')).first().should('be.focused');
        cy.get(by('recipe-close')).click();
        cy.get(by('recipe-popover')).should('not.exist');
        card(id).find(selector).should('be.focused');
      }
      // Target Enter at the trigger; use native Tab for browser focus navigation.
      card(id).find(by('recipe-trigger')).first().scrollIntoView().focus().should('be.focused').type('{enter}');
      cy.get(by('recipe-link')).first().should('be.focused');
      cy.press(Cypress.Keyboard.Keys.TAB);
      cy.get(by('recipe-link')).last().should('be.focused');
      cy.get(by('recipe-link')).last().type('{esc}');
      cy.get(by('recipe-popover')).should('not.exist');
      card(id).find(by('recipe-trigger')).first().should('be.focused').click();
      cy.contains('釣行一覧').click();
      cy.get(by('recipe-popover')).should('not.exist');
      card(id).find(by('edit-catch')).should('be.visible');
    });
  });

  it('必須項目が空なら保存リクエストを送らず、修正後に保存できる', () => {
    visit();
    let requests = 0;
    cy.intercept('POST', '/api/catches', req => {requests++;}).as('save');
    cy.get(by('record-catch')).click();
    cy.get(by('save-catch')).click();
    cy.get('[id="catch-error-location"]').scrollIntoView().should('be.visible').and('contain','場所を入力してください。');
    cy.get('[id="catch-error-fish.0.species"]').scrollIntoView().should('be.visible').and('contain','魚種を入力してください。');
    cy.then(() => {expect(requests).to.equal(0);});
    cy.get(by('catch-location')).type(`${marker}-validation`);
    cy.get(by('fish-species')).type('シロギス');
    cy.get(by('catch-memo')).type(marker);
    cy.get(by('save-catch')).click();
    cy.wait('@save').then(({response}) => {
      expect(response.statusCode).to.equal(201);
      createdIds.push(response.body.id);
      cy.wait('@list').its('response.statusCode').should('equal', 200);
      card(response.body.id).should('contain', 'シロギス');
    });
  });

  it('作成した釣果を編集し、再読み込み後も変更が残る', () => {
    create('edit').then(id => {
      visit();
      card(id).find(by('edit-catch')).click();
      cy.get(by('fish-species')).clear().type('シロギス');
      cy.get(by('fish-count')).clear().type('3');
      cy.get(by('fish-length')).clear().type('25');
      cy.intercept('PUT', `/api/catches/${id}`).as('edit');
      cy.get(by('save-catch')).click();
      cy.wait('@edit').its('response.statusCode').should('equal', 200);
      cy.wait('@list').its('response.statusCode').should('equal', 200);
      card(id).should('contain', 'シロギス').and('contain', '3 匹').and('contain', '25 cm');
      reload();
      card(id).should('contain', 'シロギス').and('contain', '3 匹').and('contain', '25 cm');
    });
  });

  it('作成した釣果を削除し、再読み込み後も表示されない', () => {
    create('delete').then(id => {
      visit();
      cy.on('window:confirm', () => true);
      cy.intercept('DELETE', `/api/catches/${id}`).as('delete');
      card(id).find(by('delete-catch')).click();
      cy.wait('@delete').its('response.statusCode').should('equal', 200);
      cy.wait('@list').its('response.statusCode').should('equal', 200);
      card(id).should('not.exist');
      reload();
      card(id).should('not.exist');
    });
  });

  it('スマートフォン幅で登録フォームを操作できる', () => {
    cy.viewport(390, 844);
    visit();
    cy.get(by('record-catch')).click();
    cy.get(by('catch-location')).type(`${marker}-mobile`);
    cy.get(by('fish-species')).type('アジ');
    cy.get(by('catch-memo')).type(marker);
    cy.intercept('POST', '/api/catches').as('save');
    cy.get(by('save-catch')).click();
    cy.wait('@save').then(({response}) => {
      expect(response.statusCode).to.equal(201);
      createdIds.push(response.body.id);
      cy.wait('@list').its('response.statusCode').should('equal', 200);
      card(response.body.id).should('contain', `${marker}-mobile`);
    });
  });

  for (const width of [1280, 390]) it(`${width}px: 位置登録・再利用・お気に入り・過去の釣行を保持`, () => {
    cy.viewport(width, 900);
    cy.intercept('GET', '/api/catches').as('list');
    cy.visit('/', {onBeforeLoad(win) {
      Object.defineProperty(win.navigator, 'geolocation', {value: {getCurrentPosition(_success, failure) {failure({code: 1});}}});
    }});
    cy.wait('@list').its('response.statusCode').should('equal', 200);
    cy.get(by('record-catch')).click();
    cy.get(by('catch-location')).type(`${marker}-map-${width}`);
    cy.get(by('get-location')).click();
    cy.contains('現在地を取得できませんでした。').should('be.visible');
    cy.contains('summary', '緯度・経度で指定').click();
    cy.get(by('latitude')).type('35.123');cy.get(by('longitude')).type('139.456');
    cy.get(by('apply-coordinates')).click();cy.get(by('selected-position')).should('contain', '35.123000');
    cy.get(by('fish-species')).type('アジ');cy.get(by('catch-memo')).type(marker);
    cy.intercept('POST', '/api/catches').as('saveMap');cy.get(by('save-catch')).click();
    cy.wait('@saveMap').then(({response}) => {
      expect(response.statusCode).to.equal(201);const id=response.body.id;createdIds.push(id);
      cy.wait('@list').its('response.statusCode').should('equal', 200);
      reload().then(({response}) => {
        const body=response.body;
        expect(body, 'catch list').to.be.an('array');
        const trip=body.find(x=>x.id===id);
        expect(trip, `saved catch ${id}`).to.exist;
        const position=trip.position;expect(position.latitude).to.equal(35.123);const spotId=position.spotId;
        cy.get(by('toggle-map')).click();
        cy.get(`${by('map-spot')}[data-spot-id="${spotId}"]`).click();
        cy.get(by('spot-detail')).should('contain', `${marker}-map-${width}`).and('contain','35.123000');
        cy.intercept('PUT',`/api/spots/${spotId}`).as('favoriteSpot');
        cy.get(by('favorite-spot')).click();cy.wait('@favoriteSpot').its('response.statusCode').should('equal',200);
        cy.get(by('map-favorites')).check();cy.get(`${by('map-spot')}[data-spot-id="${spotId}"]`).should('exist');
        cy.get(by('map-species')).select('アジ');
        cy.get(by('map-start')).type('2099-01-01');cy.get(`${by('map-trip')}[data-catch-id="${id}"]`).should('not.exist');
        cy.get(by('map-start')).clear();cy.get(`${by('map-spot')}[data-spot-id="${spotId}"]`).click();
        cy.get(by('edit-spot')).click();cy.get(by('spot-name')).clear().type(`${marker}-renamed-${width}`);
        cy.get('.spot-edit summary').click();cy.get('.spot-edit '+by('latitude')).clear().type('36');
        cy.get('.spot-edit '+by('apply-coordinates')).click();
        cy.intercept('PUT',`/api/spots/${spotId}`).as('editSpot');
        cy.get(by('save-spot')).click();
        cy.wait('@editSpot').then(({request,response})=>{
          expect(response.statusCode).to.equal(200);
          expect(request.body.name).to.equal(`${marker}-renamed-${width}`);
          expect(request.body.latitude).to.equal(36);
        });
        cy.get(by('spot-detail')).should('contain', `${marker}-renamed-${width}`);
        // Validate persistence using the reload response consumed by the UI.
        // Check the exact saved ID and coordinates after reloading, not only local UI state.
        reload().then(({response})=>{
          expect(response.body, 'reloaded catch list').to.be.an('array');
          const saved=response.body.find(x=>x.id===id);
          expect(saved, `preserved catch ${id}`).to.exist;
          expect(saved.location).to.equal(`${marker}-map-${width}`);
          expect(saved.position).to.include({latitude:35.123,longitude:139.456,spotId});
        });
        card(id).should('contain',`${marker}-map-${width}`);
        cy.get(by('toggle-map')).click();
        cy.get(`${by('map-spot')}[data-spot-id="${spotId}"]`).click();
        cy.get(by('spot-detail')).should('contain',`${marker}-renamed-${width}`);
        cy.get(`${by('map-trip')}[data-catch-id="${id}"]`).should('contain',`${marker}-map-${width}`).and('contain','35.123000, 139.456000');
        cy.get(by('record-catch')).click();cy.get(by('past-spot')).select(String(spotId));
        cy.get(by('catch-location')).should('have.value',`${marker}-renamed-${width}`);
        cy.get(by('selected-position')).should('contain','36.000000');
        cy.get(by('fish-species')).type('アジ');cy.get(by('catch-memo')).type(marker);cy.get(by('save-catch')).click();
        cy.wait('@saveMap').then(({response})=>{expect(response.statusCode).to.equal(201);createdIds.push(response.body.id)});
        cy.wait('@list').its('response.statusCode').should('equal',200);
      });
    });
  });

  (Cypress.expose('hasOtherUser') ? it : it.skip)('別ユーザーは公開釣果を閲覧できるが、編集・削除できない', () => {
    create('permissions').then(id => {
      login('other');
      visit();
      card(id).should('contain', `${marker}-permissions`);
      card(id).find(by('edit-catch')).should('not.exist');
      card(id).find(by('delete-catch')).should('not.exist');
      for (const method of ['PUT', 'DELETE']) cy.request({method, url: `/api/catches/${id}`,
        body: method === 'PUT' ? payload('forbidden') : undefined, failOnStatusCode: false,
        headers: {Origin: Cypress.config('baseUrl')}, log: false}).its('status').should('equal', 403);
      login();
      reload();
      card(id).should('contain', `${marker}-permissions`);
    });
  });
});
