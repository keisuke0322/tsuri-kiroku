import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(filename)
      : /\.tsx?$/.test(entry.name)
        ? [filename]
        : [];
  });
}

test('Tailwind scans every UI primitive reachable from app code', () => {
  const css = readFileSync(path.join(root, 'app/globals.css'), 'utf8');
  const pending = sourceFiles(path.join(root, 'app'));
  const visited = new Set();

  while (pending.length) {
    const filename = pending.pop();
    if (visited.has(filename)) continue;
    visited.add(filename);

    const source = readFileSync(filename, 'utf8');
    for (const match of source.matchAll(
      /['"]@\/components\/ui\/([^'"]+)['"]/g,
    )) {
      const relative = `components/ui/${match[1]}.tsx`;
      assert.ok(
        css.includes(`@source '../${relative}';`),
        `${relative} needs a Tailwind @source entry in app/globals.css`,
      );
      pending.push(path.join(root, relative));
    }
  }
});
