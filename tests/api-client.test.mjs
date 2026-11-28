import assert from 'node:assert/strict';
import { build } from 'vite';
import { test } from 'node:test';
import { sessionRequest } from '../lib/api/session.ts';

const compiled = await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    minify: false,
    target: 'esnext',
    lib: {
      entry: 'lib/api/generated/browser.gen.ts',
      formats: ['es'],
      fileName: 'client',
    },
  },
});
const { browserApi } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(
      (Array.isArray(compiled) ? compiled[0] : compiled).output[0].code,
    ).toString('base64')
);

test('navigation stops API calls before they start and a 401 triggers login', async () => {
  let started = 0;
  let redirected = 0;
  const start = async () => {
    started++;
    return new Response(null, { status: 401 });
  };
  await assert.rejects(
    sessionRequest(
      start,
      () => true,
      () => redirected++,
    ),
    /ログイン画面へ移動/,
  );
  assert.equal(started, 0);
  assert.equal(redirected, 0);
  await assert.rejects(
    sessionRequest(
      start,
      () => false,
      () => redirected++,
    ),
    /ログインしてください/,
  );
  assert.equal(started, 1);
  assert.equal(redirected, 1);
});

test('generated client serializes JSON, paths, queries and multipart with existing response handling', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = { location: { origin: 'https://test.example' } };
  let received;
  let reply = () => Response.json({ id: 7 }, { status: 201 });
  globalThis.fetch = async (request) => {
    received = request;
    return reply();
  };
  try {
    const input = {
      date: '2026-11-28',
      location: '港',
      fish: [{ species: 'アジ', count: 2, length: null }],
      memo: '',
    };
    const created = await browserApi.createCatch({ body: input });
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), { id: 7 });
    assert.equal(received.url, 'https://test.example/api/catches');
    assert.equal(received.method, 'POST');
    assert.equal(received.credentials, 'same-origin');
    assert.equal(received.cache, 'no-store');
    assert.match(received.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await received.json(), input);

    reply = () =>
      Response.json({ userId: '日本/1', displayName: '釣り人', bio: '' });
    await browserApi.getUserProfile({ path: { userId: '日本/1' } });
    assert.match(received.url, /profiles\/%E6%97%A5%E6%9C%AC%2F1$/);
    reply = () => Response.json({ items: [], more: false });
    await browserApi.getGearHistory({
      query: { offset: '50', species: 'アジ' },
    });
    assert.equal(new URL(received.url).searchParams.get('species'), 'アジ');
    assert.equal(new URL(received.url).searchParams.get('offset'), '50');

    reply = () =>
      Response.json(
        { id: 8, species: 'アジ', featured: true },
        { status: 201 },
      );
    await browserApi.uploadPhoto({
      path: { id: '7' },
      body: {
        photo: new File(['image'], '魚.jpg', { type: 'image/jpeg' }),
        species: 'アジ',
        featured: 'true',
      },
    });
    assert.match(
      received.headers.get('content-type'),
      /multipart\/form-data; boundary=/,
    );
    const form = await received.formData();
    assert.equal(form.get('photo').name, '魚.jpg');
    assert.equal(await form.get('photo').text(), 'image');
    assert.equal(form.get('species'), 'アジ');
    assert.equal(form.get('featured'), 'true');

    reply = () =>
      Response.json({ error: 'ログインしてください。' }, { status: 401 });
    const unauthorized = await browserApi.getProfile();
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.ok, false);
    assert.deepEqual(await unauthorized.json(), {
      error: 'ログインしてください。',
    });
    reply = () => new Response(null, { status: 204 });
    const loggedOut = await browserApi.logout();
    assert.equal(loggedOut.status, 204);
    assert.equal(await loggedOut.text(), '');
    assert.equal(received.method, 'POST');

    globalThis.fetch = async () => {
      throw Error('offline');
    };
    await assert.rejects(browserApi.listCatches(), /通信に失敗/);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});
