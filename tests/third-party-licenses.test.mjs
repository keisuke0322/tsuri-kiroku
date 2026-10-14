import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {thirdPartyLicenses} from '../build/third-party-licenses.ts';

test('notices retain scoped-package and embedded licenses across build environments', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'tsuri-license-'));
  try {
    const plugin = thirdPartyLicenses();
    const emitted = [];
    const context = {emitFile: asset => emitted.push(asset), error: message => {throw new Error(message);}};
    const addPackage = (name, license) => {
      const directory = path.join(root, 'node_modules', name);
      mkdirSync(path.join(directory, 'dist'), {recursive: true});
      writeFileSync(path.join(directory, 'package.json'), JSON.stringify({name, version: '1.0.0', license: 'MIT'}));
      if (license) writeFileSync(path.join(directory, 'LICENSE'), license);
      const id = path.join(directory, 'dist/index.js');
      writeFileSync(id, 'export const value = 1;');
      return id;
    };
    const first = addPackage('@example/server', 'Copyright server author\nMIT permission');
    const embedded = path.join(path.dirname(first), 'LICENSE');
    writeFileSync(embedded, 'Copyright embedded author\nBSD permission');
    plugin.generateBundle.call(context, {}, {chunk: {type: 'chunk', modules: {[first]: {renderedLength: 20}}}});
    const second = addPackage('client', 'Copyright client author\nMIT permission');
    plugin.generateBundle.call(context, {}, {chunk: {type: 'chunk', modules: {[second]: {renderedLength: 20}}}});
    for (const expected of ['Copyright server author', 'Copyright embedded author', 'Copyright client author']) {
      assert.ok(emitted.at(-1).source.includes(expected));
    }
    const missing = addPackage('missing-notice');
    assert.throws(() => plugin.generateBundle.call(context, {}, {chunk: {type: 'chunk', modules: {[missing]: {renderedLength: 20}}}}), /no license text found/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
