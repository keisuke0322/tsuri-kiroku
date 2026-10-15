import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyDeployment } from '../scripts/cloudflare-smoke.mjs';

const origin = 'https://test.example';
const headers = { 'Cache-Control': 'private, no-store' };

function fixture({
  oldPages = 0,
  neverReady = false,
  publicList = false,
  publicPhoto = false,
} = {}) {
  let visits = 0;
  const calls = [],
    pauses = [];
  return {
    calls,
    pauses,
    options: {
      attempts: 3,
      delay: 1,
      pause: async (ms) => {
        pauses.push(ms);
      },
      request: async (url) => {
        const path = new URL(url).pathname;
        calls.push(url);
        if (path === '/') {
          visits++;
          return new Response(
            neverReady || visits <= oldPages
              ? 'Googleでログイン <a data-cy="guest-entry">ゲストで見てみる</a>'
              : 'Googleでログイン',
          );
        }
        const status = path.startsWith('/images/samples/')
          ? 404
          : (publicList && path === '/api/catches') ||
              (publicPhoto && path === '/api/photos/1')
            ? 200
            : 401;
        return Response.json({}, { status, headers });
      },
    },
  };
}

test('rollback waits until the old guest entry has disappeared', async () => {
  const f = fixture({ oldPages: 1 });
  await verifyDeployment(origin, f.options);
  assert.equal(f.pauses.length, 1);
  assert.ok(f.calls.includes(origin + '/?guest=1'));
});
test('a deployment still offering guest access fails after bounded retries', async () => {
  const f = fixture({ neverReady: true });
  await assert.rejects(verifyDeployment(origin, f.options), /Guest removal/);
  assert.equal(f.pauses.length, 2);
  assert.ok(!f.calls.includes(origin + '/api/catches'));
});
test('readiness retries never mask anonymous catch or photo access', async () => {
  for (const config of [{ publicList: true }, { publicPhoto: true }]) {
    const f = fixture(config);
    await assert.rejects(
      verifyDeployment(origin, f.options),
      /must reject unauthenticated access/,
    );
    assert.equal(f.pauses.length, 0);
  }
});
