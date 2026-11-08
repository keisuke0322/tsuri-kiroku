import test from 'node:test';
import assert from 'node:assert/strict';
import { trackUpdates } from '../scripts/update-tracking.cjs';
import { publishProgress, UpdatePending } from '../scripts/update-progress.cjs';

function fixture(pr, runs = []) {
  const comments = [];
  return {
    comments,
    context: {
      repo: { owner: 'owner', repo: 'repo' },
      serverUrl: 'https://github.com',
      runId: 10,
    },
    github: {
      paginate: async () => [],
      rest: {
        pulls: {
          list: async () => ({ data: [pr] }),
          get: async () => ({ data: pr }),
        },
        actions: {
          listWorkflowRuns: async () => ({ data: { workflow_runs: runs } }),
          listJobsForWorkflowRun: async () => ({
            data: {
              jobs: [
                {
                  steps: [
                    {
                      name: 'Run authenticated staging E2E',
                      status: 'in_progress',
                    },
                  ],
                },
              ],
            },
          }),
        },
        issues: {
          listComments: 'comments',
          createComment: async (c) => comments.push(c),
        },
      },
    },
  };
}
const pr = {
  number: 109,
  state: 'open',
  head: { ref: 'dependabot/npm/test', sha: 'new-head' },
  body: 'Refs #95',
};

test('queued validation shows blocker and requires no repeated dispatch', async () => {
  const f = fixture(pr, [
    {
      id: 20,
      display_title: 'PR #109｜依存更新のstaging検証｜main',
      status: 'pending',
    },
    {
      id: 19,
      display_title: 'PR #108｜開発用stagingへ復帰｜main',
      status: 'in_progress',
    },
  ]);
  await trackUpdates(f);
  const body = f.comments[0].body;
  assert.match(body, /開始待ち/);
  assert.match(body, /再実行は不要/);
  assert.match(body, /PR #108/);
  assert.match(body, /actions\/runs\/19/);
  assert.match(body, /new-head/);
  assert.match(body, /issues\/95/);
});

test('merged PR retains restoration progress and current test step', async () => {
  const f = fixture(
    {
      ...pr,
      state: 'closed',
      merged_at: new Date().toISOString(),
      merge_commit_sha: 'merge',
    },
    [
      {
        id: 22,
        display_title: 'PR #109｜開発用stagingへ復帰｜main',
        status: 'in_progress',
      },
    ],
  );
  await trackUpdates(f);
  assert.match(f.comments[0].body, /復帰待ち・実行中/);
  assert.match(f.comments[0].body, /Run authenticated staging E2E/);
  assert.match(f.comments[0].body, /Closed/);
  assert.doesNotMatch(f.comments[0].body, /✅ マージ可能/);
});

test('restoration failure never reports completion', async () => {
  const f = fixture({ ...pr, merged_at: new Date().toISOString() }, [
    {
      id: 22,
      display_title: 'PR #109｜開発用stagingへ復帰｜main',
      status: 'completed',
      conclusion: 'failure',
    },
  ]);
  await trackUpdates(f);
  assert.match(f.comments[0].body, /復帰に失敗/);
  assert.doesNotMatch(f.comments[0].body, /復帰・自動テストが成功/);
});

test('start instructions include every workflow input', async () => {
  const f = fixture(pr);
  await publishProgress(f, pr, new UpdatePending('start', '検証未開始'));
  assert.match(
    f.comments[0].body,
    /Branch: `main`、action: `start-update`、pr: `109`/,
  );
});

test('outdated branch error explains recovery in Japanese', async () => {
  const f = fixture(pr);
  await publishProgress(
    f,
    pr,
    Error('Update branch must include current main; rebase and revalidate.'),
  );
  assert.match(f.comments[0].body, /@dependabot rebase/);
  assert.match(f.comments[0].body, /start-update/);
});
