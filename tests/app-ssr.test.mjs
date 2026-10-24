import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { createElement } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToString } from 'react-dom/server';
import dynamic from 'vinext/shims/dynamic';
import ts from 'typescript';

test('authenticated startup renders without importing the dashboard on the Worker', async () => {
  const context = vm.createContext({ console });
  let dashboardImports = 0;
  const synthetic = (exports) =>
    new vm.SyntheticModule(
      Object.keys(exports),
      function () {
        for (const [key, value] of Object.entries(exports))
          this.setExport(key, value);
      },
      { context },
    );
  const jsx = synthetic(jsxRuntime),
    dynamicModule = synthetic({ default: dynamic });
  async function component(filename) {
    const source = ts.transpileModule(await readFile(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    return new vm.SourceTextModule(source, {
      context,
      identifier: filename,
      importModuleDynamically() {
        dashboardImports++;
        throw Error('The dashboard must load only in the browser.');
      },
    });
  }
  const brand = await component('app/brand.tsx'),
    app = await component('app/fishing-app.tsx');
  await app.link((specifier) => {
    if (specifier === 'react/jsx-runtime') return jsx;
    if (specifier === 'next/dynamic') return dynamicModule;
    if (specifier === './brand') return brand;
    throw Error(`Unexpected server import: ${specifier}`);
  });
  await app.evaluate();
  const html = renderToString(
    createElement(app.namespace.default, {
      mapsApiKey: '',
      userId: 'test-owner',
      initialName: '釣り人',
      signInPath: '/api/auth/google',
      signOutPath: '/api/auth/logout',
    }),
  );
  await new Promise(setImmediate);
  assert.equal(dashboardImports, 0);
  assert.match(html, /role="status"/);
  assert.match(html, /つりめぐり/);
  assert.match(html, /画面を読み込んでいます/);
  assert.doesNotMatch(html, /data-cy="record-catch"/);
  assert.ok(html.length < 2000, 'Startup HTML must remain lightweight.');
});
