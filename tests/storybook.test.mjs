import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readFile,
  mkdtemp,
  mkdir,
  writeFile,
  access,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { stageStorybook } from '../scripts/build-storybook-assets.mjs';
import { verifyStorybook } from '../scripts/storybook-smoke.mjs';

test('only staging serves Storybook; assets cannot bypass the worker', async () => {
  const context = vm.createContext({ Request, Response, Headers, URL });
  const handler = new vm.SyntheticModule(
    ['default'],
    function () {
      this.setExport('default', {
        fetch() {
          throw Error('Storybook must not render the application');
        },
      });
    },
    { context },
  );
  const catches = new vm.SyntheticModule(
    ['GET'],
    function () {
      this.setExport('GET', () => {
        throw Error('Storybook must not access catch data');
      });
    },
    { context },
  );
  const source = ts.transpileModule(await readFile('worker.ts', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) =>
    specifier.includes('catches') ? catches : handler,
  );
  await module.evaluate();
  const worker = module.namespace.default;
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  assert.deepEqual(config.assets.run_worker_first, [
    '/storybook',
    '/storybook/*',
  ]);
  let calls = 0;
  const env = {
    ASSETS: {
      async fetch(request) {
        calls++;
        assert.equal(request.headers.get('cookie'), null);
        assert.equal(request.headers.get('authorization'), null);
        const url = new URL(request.url);
        assert.equal(url.search, '');
        const known = [
          '/storybook/index.html',
          '/storybook/iframe.html',
          '/storybook/assets/preview.js',
        ];
        return new Response(request.method === 'HEAD' ? null : url.pathname, {
          status: known.includes(url.pathname) ? 200 : 404,
        });
      },
    },
  };
  for (const APP_ENV of [undefined, 'local', 'production', 'true']) {
    for (const suffix of [
      '',
      '/',
      '/index.html',
      '/iframe.html',
      '/index.json',
      '/assets/preview.js',
    ]) {
      const response = await worker.fetch(
        new Request(`https://example.test/storybook${suffix}`),
        { ...env, APP_ENV },
        {},
      );
      assert.equal(response.status, 404);
    }
  }
  assert.equal(calls, 0);
  const staging = { ...env, APP_ENV: 'staging' };
  const redirect = await worker.fetch(
    new Request('https://example.test/storybook?path=/docs/button--docs'),
    staging,
    {},
  );
  assert.equal(redirect.status, 308);
  assert.equal(
    redirect.headers.get('location'),
    'https://example.test/storybook/?path=/docs/button--docs',
  );
  for (const method of ['GET', 'HEAD']) {
    for (const suffix of [
      '/?path=/docs/button--docs',
      '/iframe.html?id=button--default',
      '/assets/preview.js',
    ]) {
      const response = await worker.fetch(
        new Request(`https://example.test/storybook${suffix}`, {
          method,
          headers: {
            Cookie: 'session=private',
            Authorization: 'Bearer private',
          },
        }),
        staging,
        {},
      );
      assert.equal(response.status, 200);
      if (method === 'HEAD') assert.equal(await response.text(), '');
    }
  }
  assert.equal(
    (
      await worker.fetch(
        new Request('https://example.test/storybook/missing.js'),
        staging,
        {},
      )
    ).status,
    404,
  );
  const post = await worker.fetch(
    new Request('https://example.test/storybook/', { method: 'POST' }),
    staging,
    {},
  );
  assert.equal(post.status, 405);
});

test('switching a staging build to production removes stale Storybook assets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'storybook-assets-'));
  try {
    const source = path.join(root, 'source');
    const destination = path.join(root, 'output');
    await mkdir(source);
    await writeFile(path.join(source, 'index.html'), 'Storybook');
    let builds = 0;
    const options = {
      source,
      destination,
      build: () => {
        builds++;
      },
    };
    await stageStorybook(
      { name: 'tsuri-kiroku-staging', vars: { APP_ENV: 'staging' } },
      options,
    );
    assert.equal(
      await readFile(path.join(destination, 'index.html'), 'utf8'),
      'Storybook',
    );
    for (const config of [
      { name: 'tsuri-kiroku-production', vars: { APP_ENV: 'production' } },
      { name: 'tsuri-kiroku-production', vars: { APP_ENV: 'staging' } },
      {},
    ]) {
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, 'stale.js'), 'old build');
      await stageStorybook(config, options);
      await assert.rejects(access(destination));
    }
    assert.equal(builds, 1);
    await assert.rejects(
      stageStorybook(
        { name: 'tsuri-kiroku-staging', vars: { APP_ENV: 'staging' } },
        {
          ...options,
          build: () => {
            throw Error('Failed build');
          },
        },
      ),
      /Failed build/,
    );
    await assert.rejects(access(destination));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('deployment verification rejects public Storybook on production', async () => {
  await verifyStorybook(
    'https://example.test',
    'production',
    async () => new Response(null, { status: 404 }),
  );
  await assert.rejects(
    verifyStorybook(
      'https://example.test',
      'production',
      async () => new Response('Storybook'),
    ),
    /must not be served/,
  );
});
