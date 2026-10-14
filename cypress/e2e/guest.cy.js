const by=name=>`[data-cy="${name}"]`;
const card=id=>cy.get(`${by('catch-card')}[data-catch-id="${id}"]`);
const marker=Cypress.expose('runMarker');
let created=[];
function login(){return cy.task('session','owner',{log:false}).then(token=>{
 const secure=Cypress.config('baseUrl').startsWith('https:');
 cy.setCookie((secure?'__Host-':'')+'tsuri_session',token,{secure,httpOnly:true,sameSite:'lax',path:'/',log:false});
})}
function visitGuest(){cy.clearCookies();cy.visit('/?guest=1');return cy.wait('@list')}
function assertNoOverflow(){cy.document().then(doc=>expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth))}
function checkPrompt(){
 cy.get(by('login-prompt-link')).should('be.visible').and('have.attr','href','/api/auth/google');
 cy.contains('button','ゲスト閲覧を続ける').click();
 cy.get(by('login-prompt-link')).should('not.exist');
 cy.get('[data-slot="dialog-overlay"]').should('not.exist');
}

describe('ゲストによる釣果閲覧',()=>{
 before(()=>expect(marker).to.match(/^E2E-[a-f0-9-]{36}$/));
 beforeEach(()=>{created=[];cy.clearCookies()});
 afterEach(()=>{if(created.length){login();for(const id of created)cy.request({method:'DELETE',url:`/api/catches/${id}`,headers:{Origin:Cypress.config('baseUrl')},failOnStatusCode:false,log:false}).its('status').should('be.oneOf',[200,404])}});

 for(const width of [1280,390]) {
  it(`${width}px: ログイン画面から探索・サンプル・写真・検索・ログイン案内へ進む`,()=>{
   cy.viewport(width,844);
   // A deterministic empty response exercises the empty state without changing any real posts.
   cy.intercept('GET','/api/catches',{statusCode:200,body:[]}).as('empty');
   cy.visit('/');cy.get('.google-login-button').should('have.attr','href','/api/auth/google');
   cy.get(by('guest-entry')).should('be.visible').click();cy.wait('@empty');
   cy.contains('h1','釣果を探す').should('be.visible');
   cy.get(by('guest-login')).should('have.attr','href','/api/auth/google');
   cy.get(by('my-catches')).should('not.exist');cy.get(by('toggle-map')).should('not.exist');
   cy.contains('ゲストに公開された釣果はまだありません').should('be.visible');
   cy.get(by('empty-samples')).click();cy.get(by('sample-notice')).should('contain','架空のデータ');
   cy.get(by('catch-card')).should('have.length',3).each($card=>expect($card).to.contain('サンプル'));
   cy.get('.ranking-list li').should('have.length',3);
   card(-1).find('.photo-thumbnail').scrollIntoView().click();
   cy.get('.photo-viewer').should('be.visible').and('contain','シロギス');
   cy.get('.photo-viewer-stage img').should('have.attr','src','/shirogisu.png').and($img=>expect($img[0].naturalWidth).to.be.greaterThan(0));
   cy.get('[aria-label="写真を閉じる"]').click();
   // Wait for dialog teardown and focus restoration before starting another input.
   cy.get('.photo-viewer').should('not.exist');
   cy.get('input[aria-label="記録を検索"]').type('サビキ').should('have.value','サビキ');cy.get(by('catch-card')).should('have.length',1);card(-2).should('contain','アジ');
   cy.get('input[aria-label="記録を検索"]').clear();
   cy.get('.ranking-list button[aria-label="シロギスの釣果を一覧で見る"]').click();cy.get(by('catch-card')).should('have.length',1);
   card(-1).find('.like-button').click();checkPrompt();
   cy.get(by('record-catch')).scrollIntoView().click();checkPrompt();
   cy.get(by('guest-favorites')).click();checkPrompt();
   cy.get(by('edit-catch')).should('not.exist');cy.get(by('delete-catch')).should('not.exist');assertNoOverflow();
   cy.get(by('guest-samples')).click();cy.get(by('sample-notice')).should('not.exist');cy.get(by('catch-card')).should('not.exist');
  });

  it(`${width}px: 公開設定が保存・再読み込み・ゲストAPI・写真に反映される`,()=>{
   cy.viewport(width,844);login();cy.intercept('GET','/api/catches').as('list');cy.visit('/');cy.wait('@list');
   cy.get(by('record-catch')).click();cy.get(by('guest-public')).should('not.be.checked');
   cy.get(by('catch-location')).type(`${marker}-guest-${width}`);cy.get(by('fish-species')).type('アジ');
   cy.get(by('catch-memo')).type(marker);cy.get(by('location-visibility')).select('private');
   cy.get(by('guest-public')).check();
   cy.get('input[aria-label="写真を選択"]').selectFile('public/shirogisu.png',{force:true});
   cy.intercept('POST','/api/catches').as('create');cy.intercept('POST','/api/catches/*/photos').as('photo');
   cy.get(by('save-catch')).should('be.enabled').click();
   cy.wait('@create').then(({request,response})=>{
    expect(response.statusCode).to.equal(201);expect(request.body.guestPublic).to.equal(true);
    const id=response.body.id;created.push(id);
    cy.wait('@photo').then(({response})=>{
     expect(response.statusCode).to.equal(201);const photoId=response.body.id;
     cy.wait('@list');cy.reload();cy.wait('@list');card(id).find(by('edit-catch')).click();
     cy.get(by('guest-public')).should('be.checked');cy.get('[data-slot="dialog-close"]').click();
     visitGuest().then(({response})=>{
      expect(response.statusCode).to.equal(200);const row=response.body.find(x=>x.id===id);
      expect(row).to.include({guestPublic:true,location:'',locationHidden:true,position:null,publicArea:null});
      expect(row).not.to.have.property('owner_id');
     });
     cy.get('input[aria-label="記録を検索"]').type(marker);card(id).should('contain',marker).and('not.contain',`${marker}-guest-${width}`);
     card(id).find(by('edit-catch')).should('not.exist');card(id).find(by('delete-catch')).should('not.exist');
     card(id).find('.photo-thumbnail').click();cy.get('.photo-viewer-stage img').should($img=>expect($img[0].naturalWidth).to.be.greaterThan(0));
     cy.get('[aria-label="写真を閉じる"]').click();
     cy.request({url:`/api/catches/${id}`,log:false}).its('body').should('include',{guestPublic:true,location:'',position:null});
     cy.request({url:`/api/photos/${photoId}`,log:false}).its('status').should('equal',200);
     for(const method of ['PUT','DELETE'])cy.request({method,url:`/api/catches/${id}`,headers:{Origin:Cypress.config('baseUrl')},failOnStatusCode:false,log:false}).its('status').should('equal',401);
     login();cy.visit('/');cy.wait('@list');card(id).find(by('edit-catch')).click();cy.get(by('guest-public')).uncheck();
     cy.intercept('PUT',`/api/catches/${id}`).as('revoke');cy.get(by('save-catch')).click();cy.wait('@revoke').its('response.statusCode').should('equal',200);cy.wait('@list');
     cy.reload();cy.wait('@list');card(id).find(by('edit-catch')).click();cy.get(by('guest-public')).should('not.be.checked');cy.get('[data-slot="dialog-close"]').click();
     visitGuest().then(({response})=>expect(response.body.some(x=>x.id===id)).to.equal(false));card(id).should('not.exist');
     for(const url of [`/api/catches/${id}`,`/api/photos/${photoId}`])cy.request({url,failOnStatusCode:false,log:false}).its('status').should('equal',404);
     assertNoOverflow();
    });
   });
  });
 }
});
