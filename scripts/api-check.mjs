import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

async function snapshot(directory = 'lib/api/generated') {
  const files = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  const result = [];
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const path = `${entry.parentPath}/${entry.name}`;
    result.push([
      path,
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    ]);
  }
  return JSON.stringify(result.sort(([a], [b]) => a.localeCompare(b)));
}

const before = await snapshot();
const generated = spawnSync(
  process.execPath,
  [process.env.npm_execpath, 'run', 'api:generate'],
  { stdio: 'inherit' },
);
if (generated.error) throw generated.error;
if (generated.status !== 0) process.exit(generated.status || 1);
if (before !== (await snapshot()))
  throw Error(
    'OpenAPI生成物が古くなっています。pnpm api:generateを実行し、生成物をコミットしてください。',
  );
console.log(
  'OpenAPI generation is reproducible and committed artifacts are current.',
);
