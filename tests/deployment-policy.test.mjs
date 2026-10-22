import { test } from 'node:test';
import assert from 'node:assert/strict';
import policy from '../scripts/deployment-policy.cjs';

const {
  checkPullRequest,
  checkProduction,
  requireStaging,
  findMergedReleasePullRequest,
} = policy;
const repository = 'keisuke0322/tsuri-kiroku';

function fixture({
  state = 'success',
  prs,
  sha = 'source',
  environment = 'staging',
} = {}) {
  const pr = {
    base: { ref: 'main', repo: { full_name: repository } },
    head: {
      ref: 'cloudflare-migration',
      sha: 'source',
      repo: { full_name: repository },
    },
    merged_at: '2026-10-03',
    merge_commit_sha: 'merge',
  };
  const calls = [];
  const github = {
    rest: {
      git: {
        getRef: async ({ ref }) => {
          if (ref !== 'heads/main')
            throw Object.assign(Error('Not found'), { status: 404 });
          return { data: { object: { sha: 'base' } } };
        },
      },
      pulls: { list: 'prs' },
      repos: {
        getCommit: async () => ({
          data: { parents: [{ sha: 'base' }, { sha: 'source' }] },
        }),
        listDeployments: 'deployments',
        listDeploymentStatuses: 'statuses',
        compareCommits: async () => ({
          data: {
            status: 'ahead',
            files: [{ filename: 'app/page.tsx' }],
            total_commits: 1,
            commits: [{ sha: 'source' }],
          },
        }),
      },
    },
    paginate: async (method, args) => {
      calls.push({ method, args });
      if (method === 'prs') return args.state === 'closed' ? (prs ?? [pr]) : [];
      if (method === 'deployments') return [{ id: 1, sha, environment }];
      return [{ state }];
    },
  };
  return {
    github,
    context: {
      repo: { owner: 'keisuke0322', repo: 'tsuri-kiroku' },
      ref: 'refs/heads/main',
      sha: 'merge',
      payload: { pull_request: pr },
    },
    calls,
    attempts: 1,
  };
}

test('merge SHA differs from staging head: promote main using PR source evidence', async () => {
  const f = fixture();
  const result = await checkProduction(f);
  assert.equal(result.pr.merge_commit_sha, 'merge');
  assert.equal(result.staging.sha, 'source');
  assert.equal(result.staging.deploymentId, 1);
  assert.equal(
    f.calls.find((c) => c.method === 'deployments').args.sha,
    'source',
  );
});
test('PR head must have successful staging', async () => {
  await checkPullRequest(fixture());
});
test('direct main pushes cannot deploy', async () => {
  await assert.rejects(checkProduction(fixture({ prs: [] })), /merged PR/);
});
test('an unrelated merged PR cannot authorize a different main commit', async () => {
  const f = fixture();
  f.context.sha = 'other';
  await assert.rejects(checkProduction(f), /merged PR/);
});
test('non-main manual deploy cannot promote production', async () => {
  const f = fixture();
  f.context.ref = 'refs/heads/cloudflare-migration';
  await assert.rejects(checkProduction(f), /must deploy main/);
});
for (const state of ['failure', 'error', 'pending', 'in_progress']) {
  test(`staging ${state} blocks release`, async () => {
    await assert.rejects(checkProduction(fixture({ state })));
  });
}
test('staging success for a different commit cannot authorize release', async () => {
  await assert.rejects(
    checkProduction(fixture({ sha: 'other' })),
    /No successful/,
  );
});
test('production success cannot replace staging evidence', async () => {
  await assert.rejects(
    checkProduction(fixture({ environment: 'production' })),
    /No successful/,
  );
});
test('forks and other source branches cannot pass PR checks', async () => {
  for (const change of ['fork', 'branch']) {
    const f = fixture();
    const head = f.context.payload.pull_request.head;
    if (change === 'fork') head.repo.full_name = 'someone/fork';
    else head.ref = 'other';
    await assert.rejects(
      checkPullRequest(f),
      /Only (cloudflare-migration|same-repository)/,
    );
  }
});
test('pending staging can finish while PR checks wait', async () => {
  const f = fixture();
  let ready = false;
  const base = f.github.paginate;
  f.github.paginate = async (method, args) =>
    method === 'statuses'
      ? [{ state: ready ? 'success' : 'pending' }]
      : base(method, args);
  await requireStaging({
    ...f,
    sha: 'source',
    attempts: 2,
    sleep: async () => {
      ready = true;
    },
  });
  assert.equal(ready, true);
});
test('latest failed deployment overrides older successful deployment', async () => {
  const f = fixture();
  f.github.paginate = async (method, args) =>
    method === 'deployments'
      ? [
          { id: 1, sha: 'source', environment: 'staging' },
          { id: 2, sha: 'source', environment: 'staging' },
        ]
      : [{ state: args.deployment_id === 2 ? 'failure' : 'success' }];
  await assert.rejects(
    requireStaging({ ...f, sha: 'source' }),
    /Staging failed/,
  );
});

test('README-only change may reuse a successful ancestor staging deployment', async () => {
  const f = fixture({ sha: 'previous' });
  f.github.paginate = async (method, args) => {
    if (method === 'prs')
      return args.state === 'closed' ? [f.context.payload.pull_request] : [];
    if (method === 'deployments')
      return args.sha
        ? []
        : [{ id: 1, sha: 'previous', environment: 'staging' }];
    if (method === 'statuses') return [{ state: 'success' }];
    return [];
  };
  f.github.rest.repos.compareCommits = async () => ({
    data: {
      status: 'ahead',
      files: [{ filename: 'README.md' }],
      total_commits: 1,
      commits: [{ sha: 'source' }],
    },
  });
  await checkPullRequest(f);
  const result = await checkProduction(f);
  assert.equal(result.staging.sha, 'previous');
});

test('source code changes cannot reuse previous staging', async () => {
  const f = fixture();
  f.github.rest.repos.compareCommits = async () => ({
    data: {
      status: 'ahead',
      files: [{ filename: 'app/page.tsx' }],
      total_commits: 1,
      commits: [{ sha: 'source' }],
    },
  });
  f.github.paginate = async (method, args) =>
    method === 'prs'
      ? []
      : method === 'deployments'
        ? args.sha
          ? []
          : [{ id: 1, sha: 'previous', environment: 'staging' }]
        : [{ state: 'success' }];
  await assert.rejects(checkPullRequest(f), /No successful staging/);
});

test('production resolves the exact merged PR without using the failing commit association endpoint', async () => {
  const f = fixture();
  f.github.rest.repos.listPullRequestsAssociatedWithCommit = async () => {
    throw Object.assign(Error('Unexpected end of JSON input'), { status: 500 });
  };
  await checkProduction(f);
  const list = f.calls.find(
    (c) => c.method === 'prs' && c.args.state === 'closed',
  );
  assert.equal(list.args.base, 'main');
  assert.equal(list.args.per_page, 100);
  assert.equal(list.args.sort, 'updated');
});

test('closed but unmerged, wrong-base and ambiguous PRs cannot authorize production', async () => {
  const f = fixture();
  const pr = f.context.payload.pull_request;
  for (const prs of [
    [{ ...pr, merged_at: null }],
    [{ ...pr, base: { ...pr.base, ref: 'cloudflare-migration' } }],
    [pr, { ...pr, number: 99 }],
  ]) {
    f.github.paginate = async () => prs;
    await assert.rejects(
      findMergedReleasePullRequest(f),
      /requires a merged PR/,
    );
  }
});

test('PR lookup API errors are propagated instead of treating a failed lookup as authorization', async () => {
  const f = fixture();
  f.github.paginate = async () => {
    throw Object.assign(Error('API unavailable'), { status: 500 });
  };
  await assert.rejects(checkProduction(f), /API unavailable/);
});
