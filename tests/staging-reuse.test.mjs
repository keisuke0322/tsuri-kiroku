import test from 'node:test';
import assert from 'node:assert/strict';
import reuse from '../scripts/staging-reuse.cjs';
import { confirmReuse } from '../scripts/reuse-staging.mjs';

const sourceSha = 'a'.repeat(40),
  targetSha = 'b'.repeat(40),
  mainSha = 'c'.repeat(40),
  treeSha = 'd'.repeat(40);
const repository = 'owner/repo';
const response = (data) => ({ data });
function fixture() {
  const source = {
    environment: 'staging',
    result: 'success',
    sha: sourceSha,
    runId: '10',
    runAttempt: '1',
    verifiedAt: '2026-11-03T01:00:00Z',
    builtAt: '2026-11-03T00:59:00Z',
    actionsUrl: 'https://github.com/owner/repo/actions/runs/10',
    runtimeConfigSha256: 'config',
    configSha256: 'original-config',
    lockfileSha256: 'lock',
    sourceTree: treeSha,
    toolchain: { node: 'v24.1.0', packageManager: 'pnpm@11.25.0' },
    migrations: [],
    appliedMigrations: ['0001.sql'],
    cloudflare: { deploymentId: 'deployment', versionId: 'version' },
  };
  const record = {
    ...source,
    sha: targetSha,
    runId: '20',
    result: 'prepared',
    builtAt: '2026-11-03T02:00:00Z',
    configSha256: 'prepared-config',
  };
  const published = {
    sha: mainSha,
    environment: 'production',
    result: 'success',
    cloudflare: { deploymentId: 'prod', versionId: 'prod-version' },
    release: { version: 'v1.0.0' },
    runId: '15',
    pr: { number: 7, headSha: sourceSha },
  };
  const releasePR = {
    number: 7,
    merged_at: '2026-11-03',
    merge_commit_sha: mainSha,
    head: { sha: sourceSha, ref: 'develop', repo: { full_name: repository } },
    base: { ref: 'main', repo: { full_name: repository } },
  };
  const sync = {
    merged_at: '2026-11-03',
    merge_commit_sha: targetSha,
    head: { ref: 'main', repo: { full_name: repository } },
    base: { ref: 'develop', repo: { full_name: repository } },
  };
  const state = {
    schema: 1,
    revision: 'revision',
    lease: null,
    deferrals: {},
    manuals: {},
    lastDevelopmentValidation: source,
  };
  const options = {
    context: {
      repo: { owner: 'owner', repo: 'repo' },
      ref: 'refs/heads/develop',
      sha: targetSha,
      runId: '20',
      eventName: 'push',
    },
  };
  const f = {
    options,
    source,
    record,
    state,
    published,
    releasePR,
    sync,
    developmentSha: targetSha,
    mainSha,
    targetTree: treeSha,
    sourceTree: treeSha,
    sourceConclusion: 'success',
    e2e: 'success',
    sourceAttempt: 1,
    sourceBranch: 'develop',
    sourceRepo: repository,
    proofConclusion: 'success',
    proofAttempt: 1,
    writes: [],
  };
  options.github = {
    rest: {
      git: {
        getRef: async ({ ref }) =>
          response({
            object: {
              type: 'commit',
              sha:
                ref === 'heads/develop'
                  ? f.developmentSha
                  : ref === 'heads/main'
                    ? f.mainSha
                    : ref.startsWith('tags/')
                      ? mainSha
                      : 'revision',
            },
          }),
        getCommit: async ({ commit_sha }) =>
          response({
            tree: {
              sha: commit_sha === targetSha ? f.targetTree : f.sourceTree,
            },
            parents: [{ sha: sourceSha }, { sha: mainSha }],
          }),
        createTree: async (args) => {
          f.writes.push(JSON.parse(args.tree[0].content));
          return response({ sha: 'tree' });
        },
        createCommit: async () => response({ sha: 'next' }),
        updateRef: async () => {},
      },
      repos: {
        getContent: async () =>
          response({
            type: 'file',
            encoding: 'base64',
            content: Buffer.from(JSON.stringify(state)).toString('base64'),
          }),
        getLatestRelease: async () =>
          response({
            tag_name: 'v1.0.0',
            body:
              '## デプロイ記録\n```json\n' +
              JSON.stringify(published) +
              '\n```',
          }),
      },
      pulls: { list: 'prs', get: async () => response(releasePR) },
      actions: {
        listJobsForWorkflowRun: 'jobs',
        getWorkflowRun: async ({ run_id }) =>
          response({
            id: Number(run_id),
            status: 'completed',
            conclusion:
              String(run_id) === '10' ? f.sourceConclusion : f.proofConclusion,
            path: '.github/workflows/cloudflare.yml',
            event: 'push',
            head_branch: String(run_id) === '10' ? f.sourceBranch : 'develop',
            head_sha:
              String(run_id) === '10'
                ? sourceSha
                : String(run_id) === '15'
                  ? mainSha
                  : targetSha,
            run_attempt:
              String(run_id) === '10' ? f.sourceAttempt : f.proofAttempt,
            repository: { full_name: f.sourceRepo },
            head_repository: { full_name: f.sourceRepo },
          }),
      },
    },
    paginate: async (method, args) => {
      if (method === 'prs') return [sync];
      if (String(args.run_id) === '15')
        return [
          { name: 'Deploy', conclusion: 'success' },
          { name: 'Publish Release', conclusion: 'success' },
        ];
      return [
        {
          name: 'Deploy',
          conclusion: 'success',
          steps: [
            {
              name: 'Run authenticated staging E2E',
              conclusion: String(args.run_id) === '10' ? f.e2e : 'skipped',
            },
            {
              name: 'Verify running version and record deployment result',
              conclusion: 'success',
            },
          ],
        },
      ];
    },
  };
  f.select = () =>
    reuse.selectReuse(options, {
      selection: { kind: 'development', sha: targetSha },
      record,
    });
  return f;
}

test('published feature sync reuses exact tested contents and keeps actual deployed identity', async () => {
  const f = fixture();
  const candidate = await f.select();
  assert.equal(candidate.source.sha, sourceSha);
  const result = await confirmReuse(
    f.record,
    candidate,
    {},
    {
      capture: async (actual) => {
        assert.equal(actual.sha, sourceSha);
        return actual;
      },
    },
  );
  assert.equal(result.sha, targetSha);
  assert.equal(result.reusedFrom.sha, sourceSha);
  assert.equal(result.builtAt, f.source.builtAt);
  assert.equal(result.configSha256, 'original-config');
  assert.equal(result.preparedConfigSha256, 'prepared-config');
});

for (const [name, change] of [
  [
    'changed source',
    (f) => {
      f.targetTree = 'changed';
    },
  ],
  [
    'changed original tree',
    (f) => {
      f.sourceTree = 'changed';
    },
  ],
  [
    'missing proof',
    (f) => {
      delete f.state.lastDevelopmentValidation;
    },
  ],
  [
    'dependency staging lease',
    (f) => {
      f.state.lease = { pr: 4 };
    },
  ],
  [
    'dependency release',
    (f) => {
      f.releasePR.head.ref = 'dependabot/npm/react';
    },
  ],
  [
    'unpublished main',
    (f) => {
      f.mainSha = 'unpublished';
    },
  ],
  [
    'stale develop',
    (f) => {
      f.developmentSha = 'advanced';
    },
  ],
  [
    'ordinary push',
    (f) => {
      f.sync.merge_commit_sha = 'other';
    },
  ],
  [
    'fork sync',
    (f) => {
      f.sync.head.repo.full_name = 'fork/repo';
    },
  ],
  [
    'changed settings',
    (f) => {
      f.record.runtimeConfigSha256 = 'changed';
    },
  ],
  [
    'changed toolchain',
    (f) => {
      f.record.toolchain = { ...f.record.toolchain, node: 'v25' };
    },
  ],
  [
    'failed source run',
    (f) => {
      f.sourceConclusion = 'failure';
    },
  ],
  [
    'cancelled source run',
    (f) => {
      f.sourceConclusion = 'cancelled';
    },
  ],
  [
    'retried source run',
    (f) => {
      f.sourceAttempt = 2;
    },
  ],
  [
    'failed E2E',
    (f) => {
      f.e2e = 'failure';
    },
  ],
  [
    'skipped source E2E',
    (f) => {
      f.e2e = 'skipped';
    },
  ],
  [
    'wrong source branch',
    (f) => {
      f.sourceBranch = 'untrusted';
    },
  ],
  [
    'wrong repository',
    (f) => {
      f.sourceRepo = 'fork/repo';
    },
  ],
  [
    'API failure',
    (f) => {
      f.options.github.rest.actions.getWorkflowRun = async () => {
        throw Error('API down');
      };
    },
  ],
])
  test(`${name} falls back to full staging verification`, async () => {
    const f = fixture();
    change(f);
    assert.equal(await f.select(), null);
  });

for (const kind of ['production', 'update', 'restore'])
  test(`${kind} cannot reuse`, async () => {
    const f = fixture();
    assert.equal(
      await reuse.selectReuse(f.options, {
        selection: { kind, sha: targetSha },
        record: f.record,
      }),
      null,
    );
  });

test('manual development invocation forces a fresh deployment and E2E', async () => {
  const f = fixture();
  f.options.context.eventName = 'workflow_dispatch';
  assert.equal(await f.select(), null);
});

test('configuration fingerprint ignores only build identity', () => {
  const config = {
    name: 'staging',
    vars: { APP_BUILD_INFO: 'old', APP_ORIGIN: 'https://staging.example' },
  };
  const hash = reuse.runtimeConfigHash(config);
  config.vars.APP_BUILD_INFO = 'new';
  assert.equal(reuse.runtimeConfigHash(config), hash);
  config.vars.APP_ORIGIN = 'https://other.example';
  assert.notEqual(reuse.runtimeConfigHash(config), hash);
});

test('live Cloudflare identity and applied schema must still match the original successful record', async () => {
  const f = fixture();
  const candidate = await f.select();
  for (const change of [
    (s) => {
      s.cloudflare.versionId = 'different';
    },
    (s) => {
      s.cloudflare.deploymentId = 'different';
    },
    (s) => {
      s.appliedMigrations.push('unexpected.sql');
    },
  ]) {
    const actual = structuredClone(f.source);
    change(actual);
    await assert.rejects(
      confirmReuse(f.record, candidate, {}, { capture: async () => actual }),
    );
  }
});

function proof(f) {
  return {
    ...f.record,
    result: 'success',
    sourceTree: treeSha,
    reusedFrom: f.source,
  };
}

test('publication verifies both the reused validation and original full E2E, bound to SHA and attempt', async () => {
  const f = fixture();
  f.state.stagingReuses = { [targetSha]: proof(f) };
  const result = await reuse.reusedStaging(f.options, targetSha, {
    id: 20,
    run_attempt: 1,
    reused: true,
  });
  assert.equal(result.sha, sourceSha);
  assert.equal(result.validatedSha, targetSha);
  await assert.rejects(
    reuse.reusedStaging(f.options, targetSha, { id: 21 }),
    /does not match/,
  );
  f.proofConclusion = 'failure';
  await assert.rejects(
    reuse.verifyReuse(f.options, proof(f)),
    /identity or result/,
  );
  f.proofConclusion = 'success';
  f.sourceAttempt = 2;
  await assert.rejects(
    reuse.verifyReuse(f.options, proof(f)),
    /identity or result/,
  );
});

test('skipped E2E without durable reuse evidence cannot complete a release', async () => {
  const f = fixture();
  await assert.rejects(
    reuse.reusedStaging(f.options, targetSha, { id: 20, reused: true }),
    /Missing/,
  );
});

test('recording full validation replaces an old reuse receipt and preserves dependency state', async () => {
  const f = fixture();
  f.options.context.sha = sourceSha;
  f.developmentSha = sourceSha;
  f.state.stagingReuses = { [sourceSha]: proof(f) };
  await reuse.rememberStaging(f.options, f.source);
  assert.equal(f.writes[0].lastDevelopmentValidation.sourceTree, treeSha);
  assert.equal(f.writes[0].stagingReuses[sourceSha], undefined);
  assert.deepEqual(f.writes[0].deferrals, {});
});

test('release gate uses original deployment identity and rejects a skipped E2E with missing proof', async () => {
  const { requireStaging } = (await import('../scripts/deployment-policy.cjs'))
    .default;
  const f = fixture();
  f.state.stagingReuses = { [targetSha]: proof(f) };
  Object.assign(f.options.github.rest.repos, {
    listDeployments: 'deployments',
    listDeploymentStatuses: 'statuses',
  });
  const paginate = f.options.github.paginate;
  f.options.github.paginate = async (method, args) =>
    method === 'deployments'
      ? [{ id: 100, sha: targetSha, environment: 'staging' }]
      : method === 'statuses'
        ? [
            {
              state: 'success',
              log_url: 'https://github.com/owner/repo/actions/runs/20/job/200',
            },
          ]
        : paginate(method, args);
  const result = await requireStaging({ ...f.options, sha: targetSha });
  assert.equal(result.sha, sourceSha);
  assert.equal(result.validatedSha, targetSha);
  delete f.state.stagingReuses;
  await assert.rejects(
    requireStaging({ ...f.options, sha: targetSha }),
    /Missing reused/,
  );
});

test('Issue completion accepts a verified reuse receipt after publication and development sync', async () => {
  const { completeReleases } = (
    await import('../scripts/release-completion.cjs')
  ).default;
  const f = fixture();
  f.state.stagingReuses = { [targetSha]: proof(f) };
  Object.assign(f.options.github.rest.actions, { listWorkflowRuns: 'runs' });
  Object.assign(f.options.github.rest.repos, {
    listReleases: 'releases',
    compareCommits: async () => response({ status: 'ahead' }),
  });
  const paginate = f.options.github.paginate;
  f.options.github.paginate = async (method, args) =>
    method === 'runs'
      ? [
          (await f.options.github.rest.actions.getWorkflowRun({ run_id: 20 }))
            .data,
        ]
      : method === 'releases'
        ? [(await f.options.github.rest.repos.getLatestRelease()).data]
        : paginate(method, args);
  const result = await completeReleases(f.options);
  assert.equal(result.state, 'completed');
  assert.equal(result.stagingEvidence.sha, sourceSha);
  assert.equal(result.stagingEvidence.validatedSha, targetSha);
  delete f.state.stagingReuses;
  await assert.rejects(completeReleases(f.options), /Missing reused/);
});
