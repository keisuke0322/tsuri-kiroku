import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('root GET/HEAD and RSC serve public assets without rendering or forwarding cookies', async () => {
  const context = vm.createContext({ Request, Response, Headers, URL });
  let renders = 0;
  const handler = new vm.SyntheticModule(
    ['default'],
    function () {
      this.setExport('default', {
        fetch() {
          renders++;
          return new Response('API handler');
        },
      });
    },
    { context },
  );
  const source = ts
    .transpileModule(await readFile('worker.ts', 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })
    .outputText.replaceAll('import.meta.env.PROD', 'true');
  const workerModule = new vm.SourceTextModule(source, { context });
  await workerModule.link((specifier) => {
    assert.equal(specifier, 'vinext/server/fetch-handler');
    return handler;
  });
  await workerModule.evaluate();
  const worker = workerModule.namespace.default;
  const env = {
    ASSETS: {
      async fetch(request) {
        assert.equal(request.headers.get('cookie'), null);
        assert.equal(request.headers.get('authorization'), null);
        assert.equal(new URL(request.url).search, '');
        return new Response(
          request.method === 'HEAD' ? null : new URL(request.url).pathname,
        );
      },
    },
  };
  for (const method of ['GET', 'HEAD']) {
    for (const cookie of ['', 'tsuri_session=owner', 'tsuri_session=other']) {
      for (const rsc of [false, true]) {
        const response = await worker.fetch(
          new Request('https://test.example/?login_error=1&_rsc=123', {
            method,
            headers: { Cookie: cookie, ...(rsc ? { RSC: '1' } : {}) },
          }),
          env,
          {},
        );
        assert.equal(response.status, 200);
        assert.equal(
          response.headers.get('cache-control'),
          'private, no-store',
        );
        assert.equal(response.headers.get('vary'), 'RSC');
        assert.equal(response.headers.get('set-cookie'), null);
        assert.match(
          response.headers.get('content-type'),
          rsc ? /text\/x-component/ : /text\/html/,
        );
        assert.equal(
          await response.text(),
          method === 'HEAD' ? '' : `/app-shell.${rsc ? 'rsc' : 'html'}`,
        );
      }
    }
  }
  assert.equal(renders, 0);
  await worker.fetch(
    new Request('https://test.example/api/bootstrap'),
    env,
    {},
  );
  await worker.fetch(
    new Request('https://test.example/', { method: 'POST' }),
    env,
    {},
  );
  assert.equal(
    renders,
    2,
    'APIs and actions continue through the authenticated framework handlers.',
  );
  const missing = await worker.fetch(
    new Request('https://test.example/'),
    {
      ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    },
    {},
  );
  assert.equal(missing.status, 503);
  assert.equal(
    renders,
    2,
    'A missing build asset must not silently resume per-request SSR.',
  );
});
