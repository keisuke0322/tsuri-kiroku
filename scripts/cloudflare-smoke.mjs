import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

export async function verifyDeployment(
  origin,
  {
    request = fetch,
    pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    attempts = 12,
    delay = 5000,
  } = {},
) {
  assert.ok(origin?.startsWith('https://'));
  // Wait for the rollback to reach the edge before checking API authorization.
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      for (const path of ['/', '/?guest=1']) {
        const response = await request(origin + path, {
          redirect: 'error',
          signal: AbortSignal.timeout(20000),
        });
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.ok(
          html.includes('Googleでログイン'),
          'Login screen is not yet available',
        );
        assert.ok(
          !html.includes('data-cy="guest-entry"') &&
            !html.includes('data-cy="guest-samples"'),
          'Guest removal is not yet available',
        );
      }
      break;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await pause(delay);
    }
  }
  // No retries can mask an authorization failure.
  for (const path of [
    '/api/catches',
    '/api/catches?guest=1',
    '/api/profile',
    '/api/spots',
    '/api/photos/1',
  ]) {
    const response = await request(origin + path, {
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(
      response.status,
      401,
      `${path} must reject unauthenticated access`,
    );
    assert.match(response.headers.get('cache-control') || '', /no-store/);
  }
  for (const path of [
    '/images/samples/aji.jpg',
    '/images/samples/shirogisu.jpg',
  ]) {
    const response = await request(origin + path, {
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 404, `${path} must no longer be served`);
  }
  console.log('Login-only access and guest removal checks passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  await verifyDeployment(process.env.APP_ORIGIN);
