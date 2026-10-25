import { diagnosePage } from '../page-diagnostics';

const marker = Cypress.expose('runMarker');
const by = (value) => `[data-cy="${value}"]`;
const point = { latitude: 35.123, longitude: 139.456 };
let createdIds;
let expectedSession;

function login() {
  return cy.task('session', 'owner', { log: false }).then((token) => {
    expectedSession = token;
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

// Use the actual form with a deterministic map service, even when staging has
// no Maps key. No real Google request, key, or billable service is needed.
function maps(mode) {
  cy.intercept('GET', '/api/bootstrap', (request) => {
    request.continue((response) => {
      response.body.mapsApiKey = mode === 'missing' ? '' : 'e2e-map-stub';
    });
  });
  cy.intercept('GET', 'https://maps.googleapis.com/maps/api/js*', {
    statusCode: 200,
    headers: { 'content-type': 'application/javascript' },
    body:
      mode === 'failed'
        ? 'window.gm_authFailure();'
        : `
window.__formMap = { listeners: {}, centers: [] };
const listener = { remove() {} };
window.google = { maps: {
 Map: class {
  constructor(el) { el.addEventListener('click', () => window.__formMap.listeners.click?.({latLng: {lat: () => 35.123, lng: () => 139.456}})); }
  setCenter(p) { window.__formMap.centers.push(p); } setZoom() {} fitBounds() {}
  addListener(name, callback) { window.__formMap.listeners[name] = callback; return listener; }
 },
 Marker: class { setMap() {} addListener() { return listener; } },
 Circle: class { setMap() {} }, LatLngBounds: class { extend() {} },
 Geocoder: class { geocode(input, callback) { callback([{geometry:{location:{lat:()=>36,lng:()=>140}}}], 'OK'); } }
}};
window.fishingMapsReady();`,
  });
}

function visit(mode = 'ready', gps = 'denied') {
  maps(mode);
  cy.on('window:before:load', (win) => {
    Object.defineProperty(win.navigator, 'geolocation', {
      configurable: true,
      value:
        gps === 'unsupported'
          ? undefined
          : {
              getCurrentPosition(success, failure) {
                if (gps === 'success') success({ coords: point });
                else failure({ code: gps === 'denied' ? 1 : 2 });
              },
            },
    });
  });
  cy.visit('/');
  cy.get(by('record-catch')).should('be.visible');
  cy.get('.discovery-loading').should('not.exist');
}

function headings(width) {
  cy.get('.entry-form > .catch-section > legend').should(($legends) => {
    expect([...$legends].map((el) => el.textContent)).to.deep.equal([
      '釣りをした場所',
      '釣った魚',
      '使用した釣り道具（任意）',
    ]);
    const styles = [...$legends].map((el) => getComputedStyle(el));
    expect(new Set(styles.map((s) => s.fontSize)).size).to.equal(1);
    expect(new Set(styles.map((s) => s.fontWeight)).size).to.equal(1);
  });
  for (const name of ['location-section', 'fish-section', 'gear-section']) {
    cy.get(by(name)).should(($section) => {
      const rect = $section[0].getBoundingClientRect();
      expect(rect.left).to.be.at.least(0);
      expect(rect.right).to.be.at.most(width);
    });
  }
  cy.get(by('location-section')).within(() => {
    cy.contains('label', '場所名 ※')
      .find('input')
      .should('have.attr', 'required');
    cy.contains('地図の位置を指定しなくても保存できます。').should('exist');
    cy.get(by('catch-location')).then(($name) => {
      cy.get('.position-editor').then(($position) => {
        cy.get(by('location-visibility')).then(($visibility) => {
          expect($name[0].compareDocumentPosition($position[0]) & 4).to.equal(
            4,
          );
          expect(
            $position[0].compareDocumentPosition($visibility[0]) & 4,
          ).to.equal(4);
        });
      });
    });
  });
  cy.get(by('gear-section')).should(
    'contain',
    'この釣行で使った道具を記録できます。',
  );
  for (const name of ['latitude', 'longitude', 'apply-coordinates'])
    cy.get(by(name)).should('not.exist');
}

function fill(label) {
  cy.get(by('catch-location')).clear().type(`${marker}-${label}`);
  cy.get(by('fish-species')).first().type('アジ');
  cy.get(by('catch-memo')).type(marker);
}

function save() {
  cy.intercept('POST', '/api/catches').as('createForm');
  cy.get(by('save-catch')).click();
  return cy.wait('@createForm').then(({ response }) => {
    expect(response.statusCode).to.equal(201);
    createdIds.push(response.body.id);
    cy.get('.entry-form').should('not.exist');
    return cy.wrap(response.body.id);
  });
}

const card = (id) => cy.get(`${by('catch-card')}[data-catch-id="${id}"]`);

function saved(id) {
  return cy.request({ url: '/api/catches', log: false }).then(({ body }) => {
    const row = body.find((value) => value.id === id);
    expect(row, `saved catch ${id}`).to.exist;
    return row;
  });
}

describe('釣果フォームの区分・任意の位置指定', () => {
  before(() => expect(marker).to.match(/^E2E-[a-f0-9-]{36}$/));
  beforeEach(() => {
    createdIds = [];
    login();
  });
  afterEach(function () {
    if (this.currentTest.state === 'failed') diagnosePage(expectedSession);
    for (const id of createdIds)
      cy.request({
        method: 'DELETE',
        url: `/api/catches/${id}`,
        log: false,
        headers: { Origin: Cypress.config('baseUrl') },
        failOnStatusCode: false,
      })
        .its('status')
        .should('be.oneOf', [200, 404]);
  });

  for (const width of [1280, 390]) {
    it(`検索・位置確定・解除と登録編集後の保持（${width}px）`, () => {
      cy.viewport(width, 900);
      visit();
      cy.get(by('record-catch')).click();
      headings(width);
      cy.get(by('position-status')).should('contain', '位置未指定');
      cy.get(by('map-search-input')).type('三浦海岸');
      cy.get(by('map-search-button')).should('not.be.disabled').click();
      cy.window().should((win) =>
        expect(win.__formMap.centers.at(-1)).to.deep.equal({
          lat: 36,
          lng: 140,
        }),
      );
      cy.get(by('position-status')).should('contain', '位置未指定');
      cy.get(by('selected-position')).should('not.exist');
      cy.contains('検索だけでは位置は確定しません。').should('exist');
      cy.get('.position-editor ' + by('google-map')).click();
      cy.get(by('position-status')).should('contain', '位置指定済み');
      cy.get(by('get-location')).click();
      cy.get(by('selected-position')).should('contain', '35.123000');
      cy.get('.position-editor [role="alert"]').should(
        'contain',
        '地図をタップして位置を指定できます。',
      );
      cy.get(by('clear-position')).click();
      cy.get(by('position-status')).should('contain', '位置未指定');
      for (const visibility of ['area', 'exact', 'private']) {
        cy.get(by('location-visibility')).select(visibility);
        cy.get(by('location-visibility-help')).should(
          'contain',
          visibility === 'private'
            ? '場所名と地図を表示しません'
            : '位置未指定',
        );
      }
      cy.get('.position-editor ' + by('google-map')).click();
      cy.get(by('location-visibility')).select('exact');
      cy.get(by('location-visibility-help')).should(
        'contain',
        '正確な位置のピンを表示します',
      );
      fill(`form-${width}`);
      save().then((id) => {
        cy.reload();
        card(id).find(by('edit-catch')).click();
        headings(width);
        cy.get(by('position-status')).should('contain', '位置指定済み');
        cy.get(by('map-search-input')).type('横浜');
        cy.get(by('map-search-button')).should('not.be.disabled').click();
        cy.get(by('selected-position')).should('contain', '35.123000');
        cy.get(by('get-location')).click();
        cy.get(by('selected-position')).should('contain', '35.123000');
        cy.get(by('catch-location')).type('-edited');
        cy.intercept('PUT', `/api/catches/${id}`).as('editForm');
        cy.get(by('save-catch')).click();
        cy.wait('@editForm').its('response.statusCode').should('equal', 200);
        cy.reload();
        card(id).should('contain', `form-${width}-edited`);
        saved(id).then((row) => {
          expect(row.position).to.include({ ...point, source: 'map' });
          expect(row.locationVisibility).to.equal('exact');
          expect(row.fish[0]).to.include({ species: 'アジ', count: 1 });
        });
      });
    });

    it(`地図とGPSが使えなくても場所名で登録・編集できる（${width}px）`, () => {
      cy.viewport(width, 900);
      visit('missing', 'unsupported');
      cy.get(by('record-catch')).click();
      headings(width);
      cy.get(by('get-location')).click();
      cy.contains('この端末では現在地を取得できません。').should('be.visible');
      cy.contains('場所名だけでも保存できます。').should('be.visible');
      cy.get('.position-editor [role="alert"]').should(
        'not.contain',
        '地図をタップ',
      );
      fill(`no-position-${width}`);
      save().then((id) => {
        cy.reload();
        card(id).find(by('edit-catch')).click();
        cy.get(by('position-status')).should('contain', '位置未指定');
        cy.get(by('catch-location')).type('-edited');
        cy.intercept('PUT', `/api/catches/${id}`).as('editNoPosition');
        cy.get(by('save-catch')).click();
        cy.wait('@editNoPosition')
          .its('response.statusCode')
          .should('equal', 200);
        cy.reload();
        card(id).should('contain', `no-position-${width}-edited`);
        saved(id).its('position').should('be.null');
      });
    });
  }

  it('地図読み込み失敗・GPS取得失敗でも保存済みの位置と魚・道具を保持する', () => {
    cy.request({
      method: 'POST',
      url: '/api/catches',
      log: false,
      headers: { Origin: Cypress.config('baseUrl') },
      body: {
        date: '2026-10-08',
        location: `${marker}-existing-position`,
        memo: marker,
        fish: [{ species: 'アジ', count: 2, length: 20 }],
        position: { ...point, source: 'gps' },
        locationVisibility: 'area',
        combinations: [
          {
            setId: null,
            setName: '',
            method: 'サビキ',
            species: ['アジ'],
            gear: [
              {
                id: null,
                kind: 'ロッド',
                name: '今回の竿',
                manufacturer: '',
                model: '',
                spec: '',
              },
            ],
          },
        ],
      },
    }).then(({ body }) => {
      const id = body.id;
      createdIds.push(id);
      saved(id).then((before) => {
        visit('failed', 'failed');
        card(id).find(by('edit-catch')).click();
        cy.contains('地図を読み込めません。').should('be.visible');
        cy.get(by('get-location')).click();
        cy.get('.position-editor [role="alert"]')
          .should('contain', '現在地を取得できませんでした。')
          .and('not.contain', '地図をタップ');
        cy.get(by('position-status')).should('contain', '位置指定済み');
        cy.get(by('selected-position')).should('contain', '35.123000');
        cy.get(by('catch-memo')).type('-edited');
        cy.intercept('PUT', `/api/catches/${id}`).as('keepPosition');
        cy.get(by('save-catch')).click();
        cy.wait('@keepPosition')
          .its('response.statusCode')
          .should('equal', 200);
        cy.reload();
        card(id).should('be.visible');
        saved(id).then((after) => {
          expect(after.position).to.deep.equal(before.position);
          // Fish rows are recreated on save; compare the recorded values,
          // while the catch ID still identifies the record under test.
          const fishValues = (rows) =>
            rows.map(({ species, count, length }) => ({
              species,
              count,
              length,
            }));
          expect(fishValues(after.fish)).to.deep.equal(fishValues(before.fish));
          expect(after.combinations).to.deep.equal(before.combinations);
          expect(after.locationVisibility).to.equal(before.locationVisibility);
        });
      });
    });
  });
});
