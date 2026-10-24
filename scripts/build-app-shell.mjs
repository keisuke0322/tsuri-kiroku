import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { unstable_dev } from 'wrangler';

// Render only the public root. All bindings are local, and no session is sent.
const worker = await unstable_dev('dist/server/index.js', {
  config: 'dist/server/wrangler.json',
  local: true,
  persist: false,
  ip: '127.0.0.1',
  port: 0,
  inspectorPort: 0,
  logLevel: 'error',
  vars: { APP_SHELL_BUILD: 'true' },
  experimental: {
    disableExperimentalWarning: true,
    disableDevRegistry: true,
    watch: false,
  },
});

try {
  for (const rsc of [false, true]) {
    const response = await fetch(
      `http://${worker.address}:${worker.port}/${rsc ? '?_rsc' : ''}`,
      {
        redirect: 'manual',
        headers: rsc ? { RSC: '1' } : {},
      },
    );
    assert.equal(
      response.status,
      200,
      `Unexpected redirect: ${response.headers.get('location')}`,
    );
    assert.equal(response.headers.get('set-cookie'), null);
    assert.match(
      response.headers.get('content-type'),
      rsc ? /text\/x-component/ : /text\/html/,
    );
    const body = await response.text();
    if (!rsc) {
      assert.match(body, /Googleでログイン/);
      assert.match(body, /<script[^>]+type="module"/);
    }
    assert.doesNotMatch(body, /data-cy="record-catch"/);
    await writeFile(`dist/client/app-shell.${rsc ? 'rsc' : 'html'}`, body);
  }
  console.log(
    'Built public app shell (HTML and RSC); authentication remains in APIs.',
  );
} finally {
  await worker.stop();
}
