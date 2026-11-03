import assert from 'node:assert/strict';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { captureDeployment } from './verify-version.mjs';

export async function confirmReuse(
  record,
  candidate,
  config,
  { capture = captureDeployment } = {},
) {
  if (!candidate) return null;
  const verified = await capture(candidate.source, config);
  assert.deepEqual(verified.cloudflare, candidate.source.cloudflare);
  assert.deepEqual(
    verified.appliedMigrations,
    candidate.source.appliedMigrations,
  );
  assert.equal(
    record.runtimeConfigSha256,
    candidate.source.runtimeConfigSha256,
  );
  return {
    ...record,
    builtAt: candidate.source.builtAt,
    preparedConfigSha256: record.configSha256,
    configSha256: candidate.source.configSha256,
    sourceTree: candidate.sourceTree,
    reusedFrom: candidate.source,
  };
}

async function main() {
  const path = '.release-runtime/record.json';
  const record = JSON.parse(await readFile(path, 'utf8'));
  const candidate = JSON.parse(
    await readFile('.release-runtime/reuse-candidate.json', 'utf8'),
  );
  let reused = false;
  try {
    const result = await confirmReuse(
      record,
      candidate,
      JSON.parse(await readFile('wrangler.deploy.json', 'utf8')),
    );
    if (result) {
      await writeFile(path, JSON.stringify(result, null, 2) + '\n');
      reused = true;
    }
  } catch {
    console.log(
      '稼働版を元の成功記録と照合できないため、通常のデプロイ・E2Eを実行します。',
    );
  }
  await appendFile(process.env.GITHUB_OUTPUT, `reused=${reused}\n`);
  if (reused)
    console.log(
      '同期後も同一内容のため、成功済みのstaging検証を再利用します。再デプロイ・E2Eは省略します。',
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
