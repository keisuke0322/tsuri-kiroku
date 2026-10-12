import test from 'node:test';
import assert from 'node:assert/strict';
import lifecycle from '../scripts/issue-status.cjs';
import projectStatus from '../scripts/project-status.cjs';
const { references, updateDeployment, updateEvent } = lifecycle;
const { STATES, setStatus, processCommand, bootstrap } = projectStatus;
const context = { repo: { owner: 'owner', repo: 'repo' }, ref: 'refs/heads/main', sha: 'release' };
function mock({ labels = ['開発中', 'bug'], current = '開発中', attached = true, state = 'open', mismatch = false } = {}) {
  const calls = [];
  const field = { id: 'status-field', name: 'Status', options: [...STATES, '開発待ち'].map((name, i) => ({ id: `option-${i}`, name, color: 'BLUE', description: '' })) };
  const priority = { id: 'priority-field', name: '優先度', options: ['高', '中', '低'].map(name => ({ id: name, name })) };
  const project = { id: 'project-7', fields: [field, priority] };
  let value = current ? { name: current, optionId: field.options.find(o => o.name === current)?.id } : null;
  const github = { graphql: async (query, vars) => {
    if (query.includes('updateProjectV2ItemFieldValue')) {
      calls.push(['field', vars.field, vars.option]);
      const option = project.fields.find(f => f.id === vars.field).options.find(o => o.id === vars.option);
      if (!mismatch) value = { name: option.name, optionId: option.id };
      return {};
    }
    if (query.includes('fieldValueByName')) return { node: { fieldValueByName: value } };
    if (query.includes('addProjectV2ItemById')) { calls.push(['add-item']); return { addProjectV2ItemById: { item: { id: 'item-1' } } }; }
    if (query.includes('projectItems')) return { repository: { issue: { id: 'issue-id', projectItems: { nodes: attached ? [{ id: 'item-1', project: { id: project.id } }] : [], pageInfo: { hasNextPage: false } } } } };
    if (query.includes('fields(first')) return { node: { fields: { nodes: project.fields, pageInfo: { hasNextPage: false } } } };
    if (query.includes('projectV2(number')) return { user: { projectV2: { id: project.id } } };
    throw new Error(`Unexpected query: ${query}`);
  }, rest: { issues: {
    get: async () => ({ data: { state, labels } }),
    getLabel: async () => ({}),
    removeLabel: async a => calls.push(['remove', a.name]),
    update: async a => calls.push(['close', a.state]),
    listForRepo() {},
  }, repos: {
    listPullRequestsAssociatedWithCommit() {},
    getCollaboratorPermissionLevel: async () => ({ data: { permission: 'write' } }),
  }, pulls: { list() {} } }, paginate: async () => [] };
  return { github, calls, project };
}
test('only explicit same-repository reference lines are release targets', () => {
  assert.deepEqual(references('Subject #9\n\nRefs #12, #13\nRefs #12\nCloses #14\nRefs owner/other#15\nText Refs #16'), [12, 13, 14]);
});
test('updates Project Status, preserves Issue classification and other Project fields', async () => {
  const { github, calls, project } = mock();
  await setStatus({ github, context, project, number: 12, status: 'staging確認待ち' });
  assert.deepEqual(calls, [['field', 'status-field', 'option-2'], ['remove', '開発中']]);
});
test('adds Issue to Project when missing', async () => {
  const { github, calls, project } = mock({ attached: false, current: null, labels: [] });
  await setStatus({ github, context, project, number: 12, status: '検討中', initial: true });
  assert.deepEqual(calls, [['add-item'], ['field', 'status-field', 'option-0']]);
});
test('delayed opened event preserves an existing 開発待ち status', async () => {
  const { github, calls, project } = mock({ current: '開発待ち', labels: [] });
  await setStatus({ github, context, project, number: 12, status: '検討中', initial: true });
  assert.deepEqual(calls, []);
});
test('failed Project readback never removes legacy labels or closes the Issue', async () => {
  const { github, calls, project } = mock({ mismatch: true });
  await assert.rejects(setStatus({ github, context, project, number: 12, status: '完了' }), /readback/);
  assert.deepEqual(calls, [['field', 'status-field', 'option-4']]);
});
test('production closes Issue only after verified Project completion', async () => {
  const { github, calls, project } = mock();
  await setStatus({ github, context, project, number: 12, status: '完了' });
  assert.deepEqual(calls, [['field', 'status-field', 'option-4'], ['remove', '開発中'], ['close', 'closed']]);
});
test('priority commands retain existing Status and unrelated labels', async () => {
  const { github, calls } = mock({ labels: ['priority:高', 'bug'] });
  await processCommand({ github, context: { ...context, actor: 'owner', issue: { number: 12 }, payload: { label: { name: 'priority:高' } } } });
  assert.deepEqual(calls, [['field', 'priority-field', '高'], ['remove', 'priority:高']]);
});
test('production completes only Issues from the exact merged release PR', async () => {
  const { github, calls } = mock({ labels: [] });
  github.paginate = async () => [
    { merged_at: 'today', merge_commit_sha: 'older', base: { ref: 'main' }, head: { ref: 'cloudflare-migration' }, body: 'Refs #99' },
    { merged_at: 'today', merge_commit_sha: 'release', base: { ref: 'main' }, head: { ref: 'cloudflare-migration' }, body: 'Refs #12' },
  ];
  const numbers = [];
  github.rest.issues.get = async a => { numbers.push(a.issue_number); return { data: { state: 'open', labels: [] } }; };
  await updateDeployment({ github, context });
  assert.deepEqual(numbers, [12]);
  assert.deepEqual(calls, [['field', 'status-field', 'option-4'], ['close', 'closed']]);
});
test('staging updates commit targets and re-verifies production-waiting PR targets', async () => {
  const { github, calls } = mock({ labels: [] });
  github.rest.repos.compareCommitsWithBasehead = async () => ({ data: { total_commits: 2, commits: [
    { commit: { message: 'Implement\n\nRefs #12' } }, { commit: { message: 'Another\n\nRefs #13' } },
  ] } });
  github.paginate = async () => [{ body: 'Refs #13', head: { sha: 'release' } }];
  await updateDeployment({ github, context: { ...context, ref: 'refs/heads/cloudflare-migration' } });
  assert.deepEqual(calls, [['field', 'status-field', 'option-2'], ['field', 'status-field', 'option-3']]);
});
test('external PR cannot update Project Status', async () => {
  const { github, calls } = mock();
  await updateEvent({ github, context: { ...context, eventName: 'pull_request_target', payload: { pull_request: {
    base: { ref: 'main' }, head: { ref: 'cloudflare-migration', repo: { full_name: 'other/repo' } }, body: 'Refs #12',
  } } } });
  assert.deepEqual(calls, []);
});
test('bootstrap migrates legacy Issue labels without closing or changing priority', async () => {
  const { github, calls } = mock();
  github.paginate = async () => [{ number: 21, labels: [{ name: 'staging確認待ち' }, { name: 'bug' }] }];
  await bootstrap({ github, context });
  assert.deepEqual(calls, [['field', 'status-field', 'option-2'], ['remove', 'staging確認待ち']]);
});
test('setup preserves existing options and adds only missing Status values', async () => {
  const existing = [
    { id: 'old-consider', name: '検討中', color: 'YELLOW', description: 'keep this' },
    { id: 'old-wait', name: '開発待ち', color: 'GRAY', description: '' },
    { id: 'old-dev', name: '開発中', color: 'BLUE', description: '' },
    { id: 'old-stage', name: 'Staging確認待ち', color: 'ORANGE', description: '' },
  ];
  let submitted;
  const github = { graphql: async (query, vars) => {
    if (query.includes('projectV2(number')) return { user: { projectV2: { id: 'project-7' } } };
    if (query.includes('fields(first')) return { node: { fields: { nodes: [{ id: 'field', name: 'Status', options: existing }], pageInfo: { hasNextPage: false } } } };
    if (query.includes('updateProjectV2Field')) {
      submitted = vars.options;
      return { updateProjectV2Field: { projectV2Field: { options: vars.options.map((o, i) => ({ ...o, id: o.id || `new-${i}` })) } } };
    }
    throw new Error('Unexpected query');
  } };
  await projectStatus.loadProject({ github, ensureOptions: true });
  assert.deepEqual(submitted.slice(0, 4), existing);
  assert.deepEqual(submitted.slice(4).map(o => o.name), ['本番反映待ち', '完了']);
});
