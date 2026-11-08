import test from 'node:test';
import assert from 'node:assert/strict';
import completion from '../scripts/release-completion.cjs';
import { STATES } from '../scripts/project-status.cjs';

function fixture() {
  const context = { repo: { owner: 'owner', repo: 'repo' } };
  const state = { schema: 1, lease: null, deferrals: {}, manuals: {} };
  const record = {
    sha: 'published',
    environment: 'production',
    result: 'success',
    cloudflare: { deploymentId: 'deploy', versionId: 'version' },
    release: { version: 'v1.0.0' },
    runId: '10',
    pr: { number: 90, headSha: 'source', references: [] },
  };
  const run = {
    id: 20,
    head_sha: 'dev',
    head_branch: 'develop',
    event: 'push',
    path: '.github/workflows/cloudflare.yml',
    status: 'completed',
    conclusion: 'success',
  };
  let branchReads = 0;
  const closed = [];
  let status = { name: '本番反映待ち', optionId: '本番反映待ち' };
  const f = {
    context,
    state,
    record,
    run,
    closed,
    synced: true,
    advance: false,
  };
  const github = {
    graphql: async (query, vars) => {
      if (query.includes('updateProjectV2ItemFieldValue')) {
        status = { name: vars.option, optionId: vars.option };
        return {};
      }
      if (query.includes('fieldValueByName'))
        return { node: { fieldValueByName: status } };
      if (query.includes('projectItems'))
        return {
          repository: {
            issue: {
              id: 'issue',
              projectItems: {
                nodes: [{ id: 'item', project: { id: 'project' } }],
                pageInfo: { hasNextPage: false },
              },
            },
          },
        };
      if (query.includes('fields(first'))
        return {
          node: {
            fields: {
              nodes: [
                {
                  id: 'status',
                  name: 'Status',
                  options: STATES.map((name) => ({ id: name, name })),
                },
              ],
              pageInfo: { hasNextPage: false },
            },
          },
        };
      if (query.includes('projectV2(number'))
        return { user: { projectV2: { id: 'project' } } };
      throw Error('Unexpected GraphQL');
    },
    rest: {
      issues: {
        get: async () => ({ data: { state: 'open', labels: [] } }),
        update: async ({ issue_number }) => closed.push(issue_number),
      },
      git: {
        getRef: async ({ ref }) => ({
          data: {
            object: {
              type: 'commit',
              sha: ref.startsWith('tags/')
                ? 'published'
                : ref.endsWith('develop')
                  ? ++branchReads > 1 && f.advance
                    ? 'new-dev'
                    : 'dev'
                  : 'state',
            },
          },
        }),
      },
      repos: {
        getContent: async () => ({
          data: {
            type: 'file',
            encoding: 'base64',
            content: Buffer.from(JSON.stringify(state)).toString('base64'),
          },
        }),
        compareCommits: async () => ({
          data: { status: f.synced ? 'ahead' : 'diverged' },
        }),
        listReleases() {},
      },
      pulls: {
        get: async () => ({
          data: {
            number: 90,
            merged_at: 'today',
            merge_commit_sha: 'published',
            base: { ref: 'main' },
          },
        }),
      },
      actions: {
        listWorkflowRuns() {},
        listJobsForWorkflowRun() {},
        getWorkflowRun: async ({ run_id }) => ({
          data:
            String(run_id) === '10'
              ? {
                  path: '.github/workflows/cloudflare.yml',
                  head_sha: 'published',
                }
              : run,
        }),
      },
    },
    paginate: async (method, args) => {
      if (method === github.rest.actions.listWorkflowRuns) return [run];
      if (method === github.rest.actions.listJobsForWorkflowRun)
        return [
          {
            name: 'Deploy',
            conclusion: 'success',
            steps: [
              {
                name: 'Verify running version and record deployment result',
                conclusion: 'success',
              },
            ],
          },
          { name: 'Publish Release', conclusion: 'success' },
        ];
      if (method === github.rest.repos.listReleases)
        return [
          {
            tag_name: 'v1.0.0',
            body:
              '## デプロイ記録\n```json\n' + JSON.stringify(record) + '\n```',
          },
        ];
      throw Error('Unexpected pagination');
    },
  };
  return {
    ...f,
    github,
    set synced(v) {
      f.synced = v;
    },
    set advance(v) {
      f.advance = v;
    },
  };
}

test('published release completes only after synced development passes staging', async () => {
  const f = fixture();
  f.record.pr.references = ['Refs #95'];
  assert.equal((await completion.completeReleases(f)).state, 'completed');
  assert.deepEqual(f.closed, [95]);
});
for (const phase of ['validating', 'verified', 'restoring']) {
  test(`staging lease ${phase} prevents completion`, async () => {
    const f = fixture();
    f.state.lease = { phase };
    assert.equal(
      (await completion.completeReleases(f)).state,
      'waiting-for-staging-restoration',
    );
  });
}
for (const status of ['failure', 'cancelled', null]) {
  test(`failed or unfinished development staging (${status}) prevents completion`, async () => {
    const f = fixture();
    f.run.conclusion = status;
    assert.equal(
      (await completion.completeReleases(f)).state,
      'waiting-for-development-staging',
    );
  });
}
test('unsynced release is not completed', async () => {
  const f = fixture();
  f.record.pr.references = ['Refs #95'];
  f.synced = false;
  assert.deepEqual((await completion.completeReleases(f)).completed, []);
  assert.deepEqual(f.closed, []);
});
test('development advancing during verification prevents completion', async () => {
  const f = fixture();
  f.advance = true;
  assert.equal(
    (await completion.completeReleases(f)).state,
    'development-changed',
  );
});
test('API failures propagate rather than declaring completion', async () => {
  const f = fixture();
  f.github.rest.repos.compareCommits = async () => {
    throw Error('API unavailable');
  };
  await assert.rejects(completion.completeReleases(f), /API unavailable/);
});
test('successful restoration is bound to its source, controller and attempt', async () => {
  const f = fixture();
  f.run.id = 30;
  f.run.event = 'workflow_dispatch';
  f.run.head_sha = 'controller';
  f.run.run_attempt = 2;
  f.state.lastRestoration = {
    sha: 'dev',
    controller: 'controller',
    runId: '30',
    runAttempt: '2',
  };
  assert.equal((await completion.completeReleases(f)).state, 'completed');
  f.run.run_attempt = 3;
  await assert.rejects(completion.completeReleases(f), /identity changed/);
});

test('a later successful restoration retry supersedes a newer cancelled push run', async () => {
  const f = fixture();
  f.run.conclusion = 'cancelled';
  f.run.updated_at = '2026-11-01T05:00:00Z';
  f.state.lastRestoration = {
    sha: 'dev',
    controller: 'controller',
    runId: '15',
    runAttempt: '2',
    verifiedAt: '2026-11-01T06:00:00Z',
  };
  const get = f.github.rest.actions.getWorkflowRun;
  f.github.rest.actions.getWorkflowRun = async (args) =>
    String(args.run_id) === '15'
      ? {
          data: {
            id: 15,
            head_sha: 'controller',
            event: 'workflow_dispatch',
            run_attempt: 2,
            path: '.github/workflows/cloudflare.yml',
            status: 'completed',
            conclusion: 'success',
          },
        }
      : get(args);
  assert.equal((await completion.completeReleases(f)).state, 'completed');
});

test('a normally completed paused job cannot complete Issues', async () => {
  const f = fixture();
  const paginate = f.github.paginate;
  f.github.paginate = async (method, args) =>
    method === f.github.rest.actions.listJobsForWorkflowRun
      ? [
          {
            name: 'Deploy',
            conclusion: 'success',
            steps: [
              {
                name: 'Verify running version and record deployment result',
                conclusion: 'skipped',
              },
              { name: 'Run authenticated staging E2E', conclusion: 'skipped' },
            ],
          },
        ]
      : paginate(method, args);
  const result = await completion.completeReleases(f);
  assert.equal(result.state, 'waiting-for-development-staging');
  assert.deepEqual(f.closed, []);
});
