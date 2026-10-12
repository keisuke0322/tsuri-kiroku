import test from 'node:test';
import assert from 'node:assert/strict';
import lifecycle from '../scripts/issue-status.cjs';
const { references, setStatus, updateDeployment } = lifecycle;
const context = { repo: { owner: 'owner', repo: 'repo' }, ref: 'refs/heads/main', sha: 'release' };
function mock(labels = ['開発中', 'bug', 'priority:高']) {
  const calls = [];
  const github = { rest: { issues: {
    get: async () => ({ data: { state: 'open', labels } }),
    getLabel: async () => ({}),
    addLabels: async a => calls.push(['add', a.labels]),
    removeLabel: async a => calls.push(['remove', a.name]),
    update: async a => calls.push(['close', a.state]),
  }, repos: { listPullRequestsAssociatedWithCommit() {} } },
  paginate: async () => [], };
  return { github, calls };
}
test('only explicit same-repository reference lines are release targets', () => {
  assert.deepEqual(references('Subject #9\n\nRefs #12, #13\nRefs #12\nCloses #14\nRefs owner/other#15\nText Refs #16'), [12, 13, 14]);
});
test('status transition preserves category and priority, closes only on completion', async () => {
  const { github, calls } = mock();
  await setStatus({ github, context, number: 12, status: 'staging確認待ち' });
  assert.deepEqual(calls, [['add', ['staging確認待ち']], ['remove', '開発中']]);
  calls.length = 0;
  await setStatus({ github, context, number: 12, status: '完了' });
  assert.deepEqual(calls, [['add', ['完了']], ['remove', '開発中'], ['close', 'closed']]);
});
test('initial event cannot reset an Issue already in development', async () => {
  const { github, calls } = mock();
  await setStatus({ github, context, number: 12, status: '検討中', initial: true });
  assert.deepEqual(calls, []);
});
test('production completes only Issues from the exact merged release PR', async () => {
  const { github, calls } = mock();
  github.paginate = async () => [
    { merged_at: 'today', merge_commit_sha: 'older', base: { ref: 'main' }, head: { ref: 'cloudflare-migration' }, body: 'Refs #99' },
    { merged_at: 'today', merge_commit_sha: 'release', base: { ref: 'main' }, head: { ref: 'cloudflare-migration' }, body: 'Refs #12' },
  ];
  const numbers = [];
  github.rest.issues.get = async a => { numbers.push(a.issue_number); return { data: { state: 'open', labels: [] } }; };
  await updateDeployment({ github, context });
  assert.deepEqual(numbers, [12]);
  assert.deepEqual(calls, [['add', ['完了']], ['close', 'closed']]);
});
test('staging scans release commits and does not regress Issues in an open release PR', async () => {
  const { github, calls } = mock();
  github.rest.repos.compareCommitsWithBasehead = async () => ({ data: { total_commits: 2, commits: [
    { commit: { message: 'Implement\n\nRefs #12' } }, { commit: { message: 'Another\n\nRefs #13' } },
  ] } });
  github.rest.pulls = { list() {} };
  github.paginate = async () => [{ body: 'Refs #13' }];
  const numbers = [];
  github.rest.issues.get = async a => { numbers.push(a.issue_number); return { data: { state: 'open', labels: [] } }; };
  await updateDeployment({ github, context: { ...context, ref: 'refs/heads/cloudflare-migration' } });
  assert.deepEqual(numbers, [12]);
  assert.deepEqual(calls, [['add', ['staging確認待ち']]]);
});
