import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {
  verifyVersion,
  captureDeployment,
} from '../scripts/verify-version.mjs';

const expected = {
  environment: 'staging',
  sha: 'a'.repeat(40),
  runId: '123',
  runAttempt: '2',
  builtAt: '2026-10-21T00:00:00Z',
  migrations: [{ name: '0001.sql' }],
};
const active = {
  ...expected,
  version: null,
  cloudflareVersionId: '12345678-1234-1234-1234-123456789abc',
  deployedAt: '2026-10-21T00:01:00Z',
};
const response = (value) =>
  Response.json(value, { headers: { 'Cache-Control': 'no-store' } });

test('deployment configuration binds safe metadata to the selected environment and records a config hash', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tsuri-version-config-'));
  try {
    await copyFile('wrangler.jsonc', join(directory, 'wrangler.jsonc'));
    await mkdir(join(directory, '.release-runtime'));
    const path = join(directory, '.release-runtime/record.json');
    await writeFile(path, JSON.stringify(expected));
    const script = resolve('scripts/cloudflare-config.mjs');
    const options = {
      cwd: directory,
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
        D1_DATABASE_ID: '12345678-1234-1234-1234-123456789abc',
        APP_ORIGIN: 'https://tsuri-kiroku-staging.example.workers.dev',
        GOOGLE_CLIENT_ID: 'test-client',
      },
      stdio: 'pipe',
    };
    execFileSync(process.execPath, [script, 'staging'], options);
    const config = JSON.parse(
      await readFile(join(directory, 'wrangler.deploy.json'), 'utf8'),
    );
    assert.equal(config.version_metadata.binding, 'CF_VERSION_METADATA');
    assert.deepEqual(JSON.parse(config.vars.APP_BUILD_INFO), {
      environment: expected.environment,
      sha: expected.sha,
      version: null,
      runId: expected.runId,
      runAttempt: expected.runAttempt,
      builtAt: expected.builtAt,
    });
    assert.match(
      JSON.parse(await readFile(path, 'utf8')).configSha256,
      /^[a-f0-9]{64}$/,
    );
    options.env.APP_ORIGIN =
      'https://tsuri-kiroku-production.example.workers.dev';
    assert.throws(
      () => execFileSync(process.execPath, [script, 'production'], options),
      /environment mismatch/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('public version API exposes only allowed deployment identifiers and disables caching', async () => {
  const env = {
    GOOGLE_CLIENT_SECRET: 'test-secret',
    CF_VERSION_METADATA: {
      id: active.cloudflareVersionId,
      timestamp: active.deployedAt,
      unknown: 'hidden',
    },
  };
  const context = vm.createContext({ Response });
  const cloudflare = new vm.SyntheticModule(
    ['env'],
    function () {
      this.setExport('env', env);
    },
    { context },
  );
  const code = ts.transpileModule(
    await readFile('app/api/version/route.ts', 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = new vm.SourceTextModule(code, { context });
  await module.link(() => cloudflare);
  await module.evaluate();
  assert.equal(module.namespace.GET().status, 503);
  env.APP_BUILD_INFO = JSON.stringify({
    ...expected,
    version: null,
    extra: 'hidden',
  });

  const result = module.namespace.GET();
  assert.match(result.headers.get('cache-control'), /no-store/);
  const value = await result.json();
  assert.deepEqual(
    Object.keys(value).sort(),
    [
      'environment',
      'sha',
      'version',
      'runId',
      'runAttempt',
      'builtAt',
      'cloudflareVersionId',
      'deployedAt',
    ].sort(),
  );
  assert.equal(value.sha, expected.sha);
  assert.ok(!JSON.stringify(value).includes('secret'));
  assert.ok(!JSON.stringify(value).includes('hidden'));
});

test('version verification rejects stale commits, reruns, wrong environments and versions', async () => {
  await verifyVersion('https://test.example', expected, {
    request: async () => response(active),
    attempts: 1,
  });
  for (const mismatch of [
    { sha: 'old' },
    { runAttempt: '1' },
    { runId: '999' },
    { environment: 'production' },
    { version: 'v0.1.0' },
    { cloudflareVersionId: null },
  ])
    await assert.rejects(
      verifyVersion('https://test.example', expected, {
        request: async () => response({ ...active, ...mismatch }),
        attempts: 1,
      }),
    );
});

test('bounded readiness retries wait for the intended Worker without accepting old metadata', async () => {
  let calls = 0,
    pauses = 0;
  await verifyVersion('https://test.example', expected, {
    request: async () =>
      response({ ...active, sha: ++calls === 1 ? 'old' : expected.sha }),
    pause: async () => {
      pauses++;
    },
    attempts: 2,
  });
  assert.equal(pauses, 1);
});

test('deployment evidence binds the live Worker, Cloudflare deployment and applied D1 migrations', async () => {
  const config = {
    account_id: 'account',
    name: 'worker',
    vars: { APP_ORIGIN: 'https://test.example' },
  };
  const versions = [
    { version_id: active.cloudflareVersionId, percentage: 100 },
  ];
  const options = {
    verify: async () => active,
    request: async () =>
      response({
        success: true,
        result: { deployments: [{ id: 'deployment', versions }] },
      }),
    run: async () =>
      JSON.stringify([{ success: true, results: [{ name: '0001.sql' }] }]),
  };
  const record = await captureDeployment(expected, config, options);
  assert.equal(record.result, 'success');
  assert.deepEqual(record.cloudflare, {
    deploymentId: 'deployment',
    versionId: active.cloudflareVersionId,
  });
  versions[0].version_id = 'wrong';
  await assert.rejects(captureDeployment(expected, config, options));
  versions[0].version_id = active.cloudflareVersionId;
  versions[0].percentage = 50;
  await assert.rejects(captureDeployment(expected, config, options));
  versions[0].percentage = 100;
  await assert.rejects(
    captureDeployment(expected, config, {
      ...options,
      run: async () => '[{"success":true,"results":[]}]',
    }),
    /not applied/,
  );
});
