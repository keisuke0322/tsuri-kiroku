import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Vite collects the preview's installed modules. Storybook also distributes
// prebundled manager/docs dependencies that are not in our node_modules graph.
const require = createRequire(import.meta.url);
for (const name of ['storybook', '@storybook/addon-docs']) {
  const metadata = JSON.parse(
    await readFile(require.resolve(`${name}/package.json`), 'utf8'),
  );
  assert.equal(
    metadata.version,
    '10.6.7',
    'Recheck vendored Storybook licenses when upgrading',
  );
}
const filename = 'storybook-static/third-party-licenses.txt';
const [preview, framework, bundled] = await Promise.all([
  readFile(filename, 'utf8'),
  readFile('vendor/storybook.LICENSE', 'utf8'),
  readFile('vendor/storybook-bundled-licenses.txt', 'utf8'),
]);
const marker = '\nStorybook bundled distribution notices\n';
await writeFile(
  filename,
  `${preview.split(marker)[0]}${marker}\n${framework}\n${bundled}`,
);
