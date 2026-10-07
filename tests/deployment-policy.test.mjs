import { test } from 'node:test';
import assert from 'node:assert/strict';
import policy from '../scripts/deployment-policy.cjs';
const { checkPullRequest, checkProduction, requireStaging } = policy;
const repository = 'keisuke0322/tsuri-kiroku';
function fixture({ state = 'success', prs, sha = 'source', environment = 'staging' } = {}) {
  const pr = { base: { ref: 'main', repo: { full_name: repository } },
    head: { ref: 'cloudflare-migration', sha: 'source', repo: { full_name: repository } },
    merged_at: '2026-10-03', merge_commit_sha: 'merge' };
  const calls = [];
  const github = { rest: { repos: { listDeployments: 'deployments', listDeploymentStatuses: 'statuses',
    listPullRequestsAssociatedWithCommit: 'prs' } },
    paginate: async (method, args) => { calls.push({ method, args });
      if (method === 'prs') return prs ?? [pr];
      if (method === 'deployments') return [{ id: 1, sha, environment }];
      return [{ state }];
    } };
  return { github, context: { repo: { owner: 'keisuke0322', repo: 'tsuri-kiroku' },
    ref: 'refs/heads/main', sha: 'merge', payload: { pull_request: pr } }, calls, attempts: 1 };
}
test('merge SHA differs from staging head: promote main using PR source evidence', async () => {
  const f = fixture(); await checkProduction(f);
  assert.equal(f.calls.find((c) => c.method === 'deployments').args.sha, 'source');
});
test('PR head must have successful staging', async () => { await checkPullRequest(fixture()); });
test('direct main pushes cannot deploy', async () => {
  await assert.rejects(checkProduction(fixture({ prs: [] })), /merged PR/);
});
test('an unrelated merged PR cannot authorize a different main commit', async () => {
  const f = fixture(); f.context.sha = 'other'; await assert.rejects(checkProduction(f), /merged PR/);
});
test('non-main manual deploy cannot promote production', async () => {
  const f = fixture(); f.context.ref = 'refs/heads/cloudflare-migration';
  await assert.rejects(checkProduction(f), /must deploy main/);
});
for (const state of ['failure', 'error', 'pending', 'in_progress']) {
  test(`staging ${state} blocks release`, async () => { await assert.rejects(checkProduction(fixture({ state }))); });
}
test('staging success for a different commit cannot authorize release', async () => {
  await assert.rejects(checkProduction(fixture({ sha: 'other' })), /No successful/);
});
test('production success cannot replace staging evidence', async () => {
  await assert.rejects(checkProduction(fixture({ environment: 'production' })), /No successful/);
});
test('forks and other source branches cannot pass PR checks', async () => {
  for (const change of ['fork', 'branch']) {
    const f = fixture(); const head = f.context.payload.pull_request.head;
    if (change === 'fork') head.repo.full_name = 'someone/fork'; else head.ref = 'other';
    await assert.rejects(checkPullRequest(f), /Only cloudflare-migration/);
  }
});
test('pending staging can finish while PR checks wait', async () => {
  const f = fixture(); let ready = false; const base = f.github.paginate;
  f.github.paginate = async (method, args) => method === 'statuses' ? [{ state: ready ? 'success' : 'pending' }] : base(method, args);
  await requireStaging({ ...f, sha: 'source', attempts: 2, sleep: async () => { ready = true; } });
  assert.equal(ready, true);
});
test('latest failed deployment overrides older successful deployment', async () => {
  const f = fixture(); f.github.paginate = async (method, args) => method === 'deployments'
    ? [{ id: 1, sha: 'source', environment: 'staging' }, { id: 2, sha: 'source', environment: 'staging' }]
    : [{ state: args.deployment_id === 2 ? 'failure' : 'success' }];
  await assert.rejects(requireStaging({ ...f, sha: 'source' }), /Staging failed/);
});
