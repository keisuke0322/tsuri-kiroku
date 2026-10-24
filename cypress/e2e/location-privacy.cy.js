const marker = Cypress.expose('runMarker');
const by = (value) => `[data-cy="${value}"]`;
let createdIds = [];
const point = { latitude: 35.123, longitude: 139.456, source: 'map' };
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
function body(label, visibility = 'area') {
  return {
    date: '2026-10-08',
    location: `${marker}-location-${label}`,
    fish: [{ species: 'アジ', count: 1 }],
    memo: marker,
    position: point,
    locationVisibility: visibility,
  };
}
function create(label, visibility) {
  return cy
    .request({
      method: 'POST',
      url: '/api/catches',
      body: body(label, visibility),
      headers: { Origin: Cypress.config('baseUrl') },
      log: false,
    })
    .then((r) => {
      expect(r.status).to.equal(201);
      createdIds.push(r.body.id);
      return r.body.id;
    });
}
const card = (id) => cy.get(`${by('catch-card')}[data-catch-id="${id}"]`);
function readRows() {
  cy.get(by('record-catch')).should('be.visible');
  cy.get('.discovery-loading').should('not.exist');
  return cy.request({ url: '/api/catches', log: false }).then((response) => {
    expect(response.status).to.equal(200);
    expect(response.body).to.be.an('array');
    return response.body;
  });
}
function visit() {
  cy.visit('/');
  return readRows();
}
function reload() {
  cy.reload();
  // Verify the rendered page and authenticated API result rather than the
  // ordinal of a browser request, which can differ across page loads.
  return readRows();
}
function close() {
  cy.get(by('close-location-map')).click();
  cy.get(by('location-map-dialog')).should('not.exist');
}
// The real Google service is checked manually; this stub verifies the component's
// marker/circle options without external network variability or billable requests.
function stubMaps() {
  cy.intercept('GET', 'https://maps.googleapis.com/maps/api/js*', {
    statusCode: 200,
    headers: { 'content-type': 'application/javascript' },
    body: `
window.__locationMapCalls={markers:[],circles:[]};
const listener={remove(){}};
window.google={maps:{
 Map:class {setCenter(){} setZoom(){} fitBounds(){} addListener(){return listener}},
 Marker:class {constructor(options){window.__locationMapCalls.markers.push(options)} setMap(){} addListener(){return listener}},
 Circle:class {constructor(options){window.__locationMapCalls.circles.push(options)} setMap(){}},
 LatLngBounds:class {extend(){}},Geocoder:class {}
}};
window.fishingMapsReady();
`,
  });
}
function mapOptions(kind) {
  cy.get(by('location-map-dialog')).then(($dialog) => {
    if (!$dialog.find(by('google-map')).length) return; // Key absent: UI displays the documented fallback.
    cy.window().should((win) => {
      const calls = win.__locationMapCalls;
      if (kind === 'exact') {
        expect(calls.markers.at(-1).position).to.deep.equal({
          lat: point.latitude,
          lng: point.longitude,
        });
        expect(calls.circles).to.have.length(0);
      } else {
        expect(calls.markers).to.have.length(0);
        expect(calls.circles.at(-1)).to.include({ radius: 8000 });
        expect(calls.circles.at(-1).center).to.deep.equal({
          lat: 35.15,
          lng: 139.45,
        });
      }
    });
  });
}
function assertSharedRows(rows, id, visibility) {
  const saved = rows.find((x) => x.id === id);
  expect(saved, `saved catch ${id}`).to.exist;
  expect(saved.locationVisibility).to.equal(visibility);
  if (visibility === 'private') {
    expect(saved.location).to.equal('');
    expect(saved.publicArea).to.equal(null);
    expect(saved.position).to.equal(null);
  } else if (visibility === 'area') {
    expect(saved.position).to.equal(null);
    expect(saved.publicArea).to.deep.equal({
      latitude: 35.15,
      longitude: 139.45,
      radius: 8000,
    });
    expect(JSON.stringify(saved)).not.to.contain('35.123');
    expect(JSON.stringify(saved)).not.to.contain('139.456');
  } else {
    expect(saved.position).to.include({
      latitude: point.latitude,
      longitude: point.longitude,
    });
    expect(saved.position).not.to.have.property('spotId');
  }
}
function assertSharedCard(id, visibility, width) {
  if (visibility === 'private') {
    card(id).find(by('location-hidden')).should('contain', '場所は非公開');
    card(id).should('not.contain', `${marker}-location-${visibility}-${width}`);
    card(id).find(by('location-map-trigger')).should('not.exist');
  } else {
    card(id).find(by('location-map-trigger')).scrollIntoView().click();
    cy.get(
      by(visibility === 'area' ? 'location-area' : 'location-exact'),
    ).should('be.visible');
    mapOptions(visibility);
    close();
  }
}
describe('釣行場所の地図と公開範囲', () => {
  before(() => expect(marker).to.match(/^E2E-[a-f0-9-]{36}$/));
  beforeEach(() => {
    createdIds = [];
    login();
    stubMaps();
  });
  afterEach(() => {
    login();
    for (const id of createdIds)
      cy.request({
        method: 'DELETE',
        url: `/api/catches/${id}`,
        headers: { Origin: Cypress.config('baseUrl') },
        failOnStatusCode: false,
        log: false,
      })
        .its('status')
        .should('be.oneOf', [200, 404]);
  });
  for (const width of [1280, 390]) {
    it(`本人は場所名から地図を開き、公開設定の編集を保存できる（${width}px）`, () => {
      cy.viewport(width, 844);
      visit();
      cy.get(by('record-catch')).click();
      cy.get(by('location-visibility')).should('have.value', 'area');
      cy.get(by('catch-location')).type(`${marker}-location-self-${width}`);
      cy.get('.position-editor summary').click();
      cy.get(by('latitude')).type(String(point.latitude));
      cy.get(by('longitude')).type(String(point.longitude));
      cy.get(by('apply-coordinates')).click();
      cy.get(by('fish-species')).type('アジ');
      cy.get(by('catch-memo')).type(marker);
      cy.intercept('POST', '/api/catches').as('createLocation');
      cy.get(by('save-catch')).click();
      cy.wait('@createLocation').then(({ response }) => {
        expect(response.statusCode).to.equal(201);
        const id = response.body.id;
        createdIds.push(id);
        card(id).should('be.visible');
        reload().then((rows) => {
          const saved = rows.find((x) => x.id === id);
          expect(saved.locationVisibility).to.equal('area');
          expect(saved.position).to.include(point);
        });
        card(id)
          .find(by('location-map-trigger'))
          .scrollIntoView()
          .focus()
          .should('be.focused');
        // Native Space activates the button. Cypress Enter omits the character
        // event required for native button activation; real Enter is checked in Chromium.
        cy.press(Cypress.Keyboard.Keys.SPACE);
        cy.get(by('location-map-dialog'))
          .should('be.visible')
          .then(($dialog) => {
            const r = $dialog[0].getBoundingClientRect();
            expect(r.left).to.be.at.least(0);
            expect(r.right).to.be.at.most(width);
          });
        cy.get(by('location-exact')).should('contain', '35.123000, 139.456000');
        cy.get(by('close-location-map')).focus().should('be.focused');
        cy.press(Cypress.Keyboard.Keys.ESC);
        cy.get(by('location-map-dialog')).should('not.exist');
        card(id).find(by('location-map-trigger')).should('be.focused');
        for (const visibility of ['private', 'exact', 'area']) {
          card(id).find(by('edit-catch')).click();
          cy.get(by('location-visibility')).select(visibility);
          cy.intercept('PUT', `/api/catches/${id}`).as('editLocation');
          cy.get(by('save-catch')).click();
          cy.wait('@editLocation')
            .its('response.statusCode')
            .should('equal', 200);
          cy.get('.form-dialog').should('not.exist');
          reload().then((rows) => {
            const saved = rows.find((x) => x.id === id);
            expect(saved.locationVisibility).to.equal(visibility);
            expect(saved.position).to.include(point);
          });
          card(id).find(by('location-map-trigger')).scrollIntoView().click();
          cy.get(by('location-exact')).should('contain', '35.123000');
          close();
          card(id).find(by('location-map-trigger')).should('be.focused');
        }
      });
    });
    for (const visibility of ['area', 'exact', 'private'])
      (Cypress.expose('hasOtherUser') ? it : it.skip)(
        `他人への${visibility}表示とAPI応答（${width}px）`,
        () => {
          cy.viewport(width, 844);
          create(`${visibility}-${width}`, visibility).then((id) => {
            login('other');
            visit().then((rows) => {
              assertSharedRows(rows, id, visibility);
            });
            assertSharedCard(id, visibility, width);
            reload().then((rows) => assertSharedRows(rows, id, visibility));
            assertSharedCard(id, visibility, width);
          });
        },
      );
  }
  it('位置未登録なら地図情報がない旨を案内する', () => {
    cy.request({
      method: 'POST',
      url: '/api/catches',
      body: { ...body('no-position'), position: null },
      headers: { Origin: Cypress.config('baseUrl') },
      log: false,
    }).then((r) => {
      expect(r.status).to.equal(201);
      const id = r.body.id;
      createdIds.push(id);
      visit();
      card(id).find(by('location-map-trigger')).scrollIntoView().click();
      cy.get(by('location-unregistered')).should('be.visible');
      cy.get(by('google-map')).should('not.exist');
      close();
    });
  });
});
