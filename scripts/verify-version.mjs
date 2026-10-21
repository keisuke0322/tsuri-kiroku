import assert from 'node:assert/strict';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { command } from './e2e-command.mjs';

export async function verifyVersion(
  origin,
  expected,
  {
    request = fetch,
    pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    attempts = 12,
  } = {},
) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await request(`${origin}/api/version`, {
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control') || '', /no-store/);
      const actual = await response.json();
      for (const key of [
        'environment',
        'sha',
        'runId',
        'runAttempt',
        'builtAt',
      ])
        assert.equal(
          actual[key],
          expected[key],
          `Deployed ${key} differs from this build`,
        );
      assert.equal(actual.version, expected.release?.version || null);
      assert.match(actual.cloudflareVersionId || '', /^[a-f0-9-]{36}$/);
      return actual;
    } catch (error) {
      if (i === attempts - 1) throw error;
      await pause(5000);
    }
  }
}

export async function captureDeployment(
  record,
  config,
  { request = fetch, run = command, verify = verifyVersion } = {},
) {
  const origin = config.vars.APP_ORIGIN;
  const version = await verify(origin, record);
  const response = await request(
    `https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/scripts/${config.name}/deployments`,
    {
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw Error('Could not read Cloudflare deployment identity.');
  const result = await response.json();
  const active = result.result?.deployments?.[0];
  assert.ok(
    result.success && active?.id,
    'Missing active Cloudflare deployment',
  );
  assert.equal(active.versions?.length, 1, 'Expected a full deployment');
  assert.equal(active.versions[0].version_id, version.cloudflareVersionId);
  assert.equal(active.versions[0].percentage, 100);
  const output = await run(
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--remote',
      '--config',
      'wrangler.deploy.json',
      '--command',
      'SELECT name FROM d1_migrations ORDER BY id',
      '--json',
    ],
    { quiet: true },
  );
  const migrations = JSON.parse(output);
  assert.ok(
    Array.isArray(migrations) &&
      migrations.length > 0 &&
      migrations.every((r) => r.success),
  );
  const applied = migrations.flatMap((r) => r.results.map((row) => row.name));
  assert.ok(
    record.migrations.every((m) => applied.includes(m.name)),
    'Some migrations are not applied',
  );
  return {
    ...record,
    deployedAt: version.deployedAt,
    verifiedAt: new Date().toISOString(),
    cloudflare: {
      deploymentId: active.id,
      versionId: version.cloudflareVersionId,
    },
    appliedMigrations: applied,
    result: 'success',
  };
}

async function main() {
  const path = '.release-runtime/record.json';
  const record = JSON.parse(await readFile(path, 'utf8'));
  if (process.env.DEPLOYMENT_RESULT !== 'success') {
    record.result = 'failure';
    await writeFile(path, JSON.stringify(record, null, 2) + '\n');
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        `## デプロイ失敗\n\n${record.environment}: ${record.sha}\n\n正式Releaseは作成しません。Workerの反映有無はCloudflareで確認してください。\n`,
      );
    return;
  }
  const config = JSON.parse(await readFile('wrangler.deploy.json', 'utf8'));
  const verified = await captureDeployment(record, config);
  await writeFile(path, JSON.stringify(verified, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '## 稼働資材の確認成功',
        `環境: ${verified.environment} / 版: ${verified.release?.version || verified.sha}`,
        `本番／稼働SHA: ${verified.sha}`,
        `検証したstaging SHA: ${verified.staging?.sha || verified.sha}`,
        `Cloudflare deployment: ${verified.cloudflare.deploymentId}`,
        `Cloudflare version: ${verified.cloudflare.versionId}`,
        `[稼働情報](${config.vars.APP_ORIGIN}/api/version) / [Actions](${verified.actionsUrl})`,
        verified.environment === 'production'
          ? '本番の反映と検証は成功しました。GitHub Release作成結果はPublish Releaseジョブを確認してください。'
          : 'stagingの動作確認・E2Eと稼働SHAの照合が成功しました。',
        '',
      ].join('\n\n'),
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
