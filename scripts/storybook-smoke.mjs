import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function verifyStorybook(origin, stage, request = fetch) {
  assert.ok(
    ['staging', 'production'].includes(stage),
    'Specify the deployment environment',
  );
  const get = (path) =>
    request(new URL(path, origin), {
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
  if (stage === 'production') {
    for (const path of [
      '/storybook',
      '/storybook/',
      '/storybook/index.html',
      '/storybook/iframe.html',
      '/storybook/index.json',
    ]) {
      assert.equal(
        (await get(path)).status,
        404,
        `${path} must not be served in production`,
      );
    }
    return;
  }
  const redirect = await get('/storybook');
  assert.equal(redirect.status, 308);
  assert.equal(
    new URL(redirect.headers.get('location'), origin).pathname,
    '/storybook/',
  );
  const manager = await get('/storybook/');
  assert.equal(manager.status, 200);
  assert.match(await manager.text(), /storybook/i);
  const index = await get('/storybook/index.json');
  assert.equal(index.status, 200);
  const { entries } = await index.json();
  assert.ok(entries['button--default']);
  assert.ok(entries['catch-date-field--default']);
  assert.ok(entries['button--docs']);
  for (const path of [
    '/storybook/?path=/docs/button--docs',
    '/storybook/iframe.html?id=button--default&viewMode=story',
  ]) {
    const response = await get(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    const assets = [
      ...html.matchAll(
        /(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g,
      ),
    ];
    assert.ok(assets.length, `${path} has no JavaScript/CSS references`);
    for (const [, asset] of assets) {
      const url = new URL(asset, new URL(path, origin));
      if (url.origin !== new URL(origin).origin) continue;
      assert.equal(
        (await request(url, { signal: AbortSignal.timeout(20000) })).status,
        200,
        `Missing ${url.pathname}`,
      );
    }
  }
  const notices = await get('/storybook/third-party-licenses.txt');
  assert.equal(notices.status, 200);
  assert.match(await notices.text(), /Storybook|storybook/);
  console.log('Storybook staging availability checks passed.');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await verifyStorybook(process.env.APP_ORIGIN, process.env.TARGET_ENV);
}
