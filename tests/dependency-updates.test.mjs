import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import stateApi from '../scripts/dependency-state.cjs';
import policy from '../scripts/dependency-policy.cjs';
import control from '../scripts/dependency-control.cjs';
import deployment from '../scripts/deployment-policy.cjs';
import sync from '../scripts/dependency-sync.cjs';

const { STATE_REF, readState, writeState } = stateApi;
const repo = { owner: 'owner', repo: 'repo' };
const fullName = 'owner/repo';
const notFound = () => {
  throw Object.assign(Error('Not found'), { status: 404 });
};
const response = (data) => ({ data });
const encode = (value) =>
  Buffer.from(
    typeof value === 'string' ? value : JSON.stringify(value),
  ).toString('base64');

function fixture() {
  const state = { schema: 1, lease: null, deferrals: {}, manuals: {} };
  const pr = {
    number: 51,
    state: 'open',
    user: { login: 'dependabot[bot]', type: 'Bot' },
    base: { ref: 'main', sha: 'main', repo: { full_name: fullName } },
    head: {
      ref: 'dependabot/npm/react',
      sha: 'head',
      repo: { full_name: fullName },
    },
    labels: [],
    body: 'Release-Version: v0.1.1\n\n### DB変更・復旧\n\nDB変更なし。',
    html_url: 'https://github.com/owner/repo/pull/51',
  };
  const pkg = {
    name: 'app',
    version: '0.1.0',
    scripts: { build: 'vinext build' },
    packageManager: 'pnpm@11.25.0',
    dependencies: { react: '19.2.6' },
  };
  const f = {
    state,
    pr,
    main: 'main',
    dev: 'dev',
    permission: 'admin',
    files: [{ filename: 'package.json' }, { filename: 'pnpm-lock.yaml' }],
    before: pkg,
    after: { ...pkg, version: '0.1.1' },
    events: [],
    openPrs: [],
    alerts: [],
    ci: 'success',
    runConclusion: 'success',
    revision: 'revision',
    writes: [],
    comments: [],
    statuses: [],
    syncPrs: [],
    refs: {},
    jobs: ['Deploy', 'Publish Release'],
    context: {
      repo,
      ref: 'refs/heads/main',
      sha: 'main',
      actor: 'admin',
      runId: 99,
      eventName: 'workflow_dispatch',
      serverUrl: 'https://github.com',
      payload: {},
    },
  };
  let treeValue;
  let n = 0;
  f.request = async () => ({
    ok: true,
    json: async () => ({
      environment: 'staging',
      sha: f.runningSha || 'head',
      runId: '99',
      cloudflareVersionId: 'cf-version',
    }),
  });
  f.github = {
    rest: {
      git: {
        getRef: async ({ ref }) => {
          if (ref === `heads/${STATE_REF}`)
            return response({ object: { sha: f.revision } });
          if (ref === 'heads/main')
            return response({ object: { sha: f.main } });
          if (ref === 'heads/cloudflare-migration')
            return response({ object: { sha: f.dev } });
          if (ref.startsWith('tags/'))
            return response({
              object: { sha: f.publishedSha || 'published', type: 'commit' },
            });
          return f.refs[ref]
            ? response({ object: { sha: f.refs[ref] } })
            : notFound();
        },
        getCommit: async ({ commit_sha }) =>
          response({ tree: { sha: commit_sha } }),
        createTree: async ({ tree }) => {
          treeValue = JSON.parse(tree[0].content);
          return response({ sha: 'tree' });
        },
        createCommit: async ({ parents }) =>
          response({ sha: `next-${++n}`, parents }),
        updateRef: async (args) => {
          f.writes.push(args);
          if (args.ref === `heads/${STATE_REF}`) {
            Object.assign(state, treeValue);
            f.revision = args.sha;
          } else f.refs[args.ref] = args.sha;
        },
        createRef: async (args) => {
          f.writes.push(args);
          f.refs[args.ref.replace('refs/', '')] = args.sha;
        },
        deleteRef: async (args) => {
          f.writes.push(args);
          delete f.refs[args.ref];
        },
      },
      repos: {
        getCollaboratorPermissionLevel: async () =>
          response({ permission: f.permission }),
        getContent: async ({ path, ref }) =>
          response({
            type: 'file',
            encoding: 'base64',
            sha: 'file-sha',
            content: encode(
              path === '.dependency-state.json'
                ? state
                : path === 'package.json'
                  ? ref === f.main
                    ? f.before
                    : f.after
                  : 'minimumReleaseAge: 10080\n',
            ),
          }),
        compareCommits: async ({ base, head }) =>
          response({
            status:
              f.comparison ||
              (head === 'cloudflare-migration' ? 'diverged' : 'ahead'),
            merge_base_commit: { sha: base },
          }),
        getCommit: async () =>
          response({ parents: [{ sha: 'main' }, { sha: 'head' }] }),
        getLatestRelease: async () =>
          response(f.release || { tag_name: 'v0.1.0' }),
        createOrUpdateFileContents: async (args) => {
          f.writes.push(args);
          f.after = JSON.parse(Buffer.from(args.content, 'base64'));
        },
        createCommitStatus: async (args) => f.statuses.push(args),
      },
      pulls: {
        get: async () => response(pr),
        listFiles: 'files',
        list: 'prs',
        update: async (args) => {
          if (args.pull_number === pr.number) Object.assign(pr, args);
          else Object.assign(f.syncPrs[0], args);
          f.writes.push(args);
        },
        create: async (args) => {
          f.syncPrs.push({ number: 52, ...args });
          f.writes.push(args);
        },
      },
      actions: {
        listWorkflowRuns: 'runs',
        getWorkflowRun: async () =>
          response({
            conclusion: f.runConclusion,
            event: 'workflow_dispatch',
            path: '.github/workflows/cloudflare.yml',
            head_sha: f.publishedSha || 'main',
          }),
        listJobsForWorkflowRun: 'jobs',
      },
      issues: {
        listEventsForTimeline: 'timeline',
        removeLabel: async () => {
          pr.labels = [];
        },
        createComment: async (args) => f.comments.push(args),
      },
    },
    paginate: async (method, args) => {
      if (method === 'files') return f.files;
      if (method === 'prs')
        return args.base === 'cloudflare-migration'
          ? f.syncPrs
          : args.state === 'closed'
            ? [pr]
            : f.openPrs;
      if (method === 'runs')
        return [
          {
            id: 10,
            head_sha: pr.head.sha,
            pull_requests: [{ number: pr.number }],
            conclusion: f.ci,
          },
        ];
      if (method === 'timeline') return f.events;
      if (method === 'jobs')
        return f.jobs.map((name) => ({ name, conclusion: 'success' }));
      if (typeof method === 'string' && method.includes('dependabot/alerts')) {
        if (f.alertError) throw f.alertError;
        return f.alerts;
      }
      throw Error(`Unexpected pagination ${method}`);
    },
  };
  return f;
}

function verified(f) {
  f.state.lease = {
    pr: 51,
    head: 'head',
    base: 'main',
    controller: 'main',
    phase: 'verified',
    validation: {
      runId: '99',
      deploymentId: 'cf',
      cloudflareVersionId: 'cf-version',
      url: 'https://github.com/actions/runs/99',
      at: '2026-10-22T00:00:00Z',
    },
    approval: { runId: '99', actor: 'admin', eventId: 7 },
  };
  f.pr.labels = [{ name: policy.APPROVAL_LABEL }];
  f.events = [
    {
      id: 7,
      event: 'labeled',
      label: { name: policy.APPROVAL_LABEL },
      actor: { login: 'admin' },
      created_at: '2026-10-22T00:01:00Z',
    },
  ];
}

test('admission permits dependency and lock-only changes while rejecting unreviewed code, scripts and forks', async () => {
  const f = fixture();
  await policy.inspectUpdate(f, f.pr, f.state);
  f.files = [{ filename: 'pnpm-lock.yaml' }];
  await policy.inspectUpdate(f, f.pr, f.state);
  for (const path of [
    'app/page.tsx',
    '.github/workflows/cloudflare.yml',
    '.npmrc',
    'pnpmfile.cjs',
  ]) {
    f.files = [{ filename: 'pnpm-lock.yaml' }, { filename: path }];
    await assert.rejects(
      policy.inspectUpdate(f, f.pr, f.state),
      /may change only/,
    );
  }
  f.files = [{ filename: 'pnpm-lock.yaml' }];
  f.after = { ...f.after, scripts: { build: 'malicious' } };
  await assert.rejects(policy.inspectUpdate(f, f.pr, f.state), /scripts/);
  f.after = f.before;
  f.pr.head.repo.full_name = 'fork/repo';
  await assert.rejects(
    policy.inspectUpdate(f, f.pr, f.state),
    /same-repository/,
  );
});

test('branch name alone cannot authorize updates; explicit administrator preparation admits manual PRs', async () => {
  const f = fixture();
  f.pr.user = { login: 'human', type: 'User' };
  await assert.rejects(policy.inspectUpdate(f, f.pr, f.state), /eligible/);
  f.state.manuals[51] = { actor: 'admin' };
  await policy.inspectUpdate(f, f.pr, f.state);
  f.comparison = 'diverged';
  await assert.rejects(policy.inspectUpdate(f, f.pr, f.state), /current main/);
});

test('emergency exceptions must be exact package versions and preserve the age policy', () => {
  const original = 'minimumReleaseAge: 10080\nstrictDepBuilds: true\n';
  policy.validateWorkspaceChange(
    original,
    original + "minimumReleaseAgeExclude:\n  - 'react@19.2.7'\n",
  );
  for (const entry of ['react', 'react@*', '*', 'react@^19.2.7'])
    assert.throws(() =>
      policy.validateWorkspaceChange(
        original,
        original + `minimumReleaseAgeExclude:\n  - '${entry}'\n`,
      ),
    );
  assert.throws(() =>
    policy.validateWorkspaceChange(original, original.replace('10080', '0')),
  );
});

test('complete source/base/run/administrator audit evidence is required, including production merge parent', async () => {
  const f = fixture();
  verified(f);
  assert.equal((await policy.requireUpdateEvidence(f, f.pr)).sha, 'head');
  f.pr.merged_at = '2026-10-22';
  f.pr.merge_commit_sha = 'production';
  f.context.sha = 'production';
  f.main = 'production';
  assert.equal((await deployment.checkProduction(f)).staging.sha, 'head');
  f.context.sha = 'direct';
  await assert.rejects(deployment.checkProduction(f), /merged PR/);
});

for (const [name, change] of [
  [
    'new head',
    (f) => {
      f.pr.head.sha = 'new';
    },
  ],
  [
    'new main',
    (f) => {
      f.main = 'new';
    },
  ],
  [
    'label only',
    (f) => {
      delete f.state.lease.approval;
    },
  ],
  [
    'label removed/re-added',
    (f) => {
      f.events[0].id++;
    },
  ],
  [
    'non-admin',
    (f) => {
      f.permission = 'write';
    },
  ],
  [
    'CI failure',
    (f) => {
      f.ci = 'failure';
    },
  ],
  [
    'staging run failure',
    (f) => {
      f.runConclusion = 'failure';
    },
  ],
  [
    'restoration in progress',
    (f) => {
      f.state.lease.phase = 'restoring';
    },
  ],
])
  test(`${name} invalidates dependency release evidence`, async () => {
    const f = fixture();
    verified(f);
    change(f);
    await assert.rejects(policy.requireUpdateEvidence(f, f.pr));
  });

test('staging lease persists after validation, blocks development/other PRs and resets approval on retry', async () => {
  const f = fixture();
  verified(f);
  f.context.ref = 'refs/heads/cloudflare-migration';
  f.context.sha = 'dev';
  await assert.rejects(control.selectDeployment(f), /paused/);
  f.context.ref = 'refs/heads/main';
  f.context.sha = 'main';
  f.state.lease.pr = 123;
  await assert.rejects(
    control.selectDeployment(f, { action: 'validate-update', number: 51 }),
    /reserved/,
  );
  f.state.lease.pr = 51;
  const result = await control.selectDeployment(f, {
    action: 'validate-update',
    number: 51,
  });
  assert.equal(result.sha, 'head');
  assert.equal(f.state.lease.phase, 'validating');
  assert.equal(f.state.lease.approval, undefined);
  assert.equal(f.state.lease.validation, undefined);
  assert.equal(f.pr.labels.length, 0);
  // An interrupted or failed build does not release the durable lease.
  assert.equal((await readState(f)).lease.phase, 'validating');
});

test('abort is administrator-only and retains restoring ownership until successful restoration', async () => {
  const f = fixture();
  verified(f);
  f.permission = 'write';
  await assert.rejects(
    control.selectDeployment(f, { action: 'abort-update' }),
    /administrator/,
  );
  f.permission = 'admin';
  assert.deepEqual(
    await control.selectDeployment(f, { action: 'abort-update' }),
    { sha: 'dev', kind: 'restore' },
  );
  assert.equal(f.state.lease.phase, 'restoring');
  f.context.ref = 'refs/heads/cloudflare-migration';
  f.context.sha = 'dev';
  await assert.rejects(control.selectDeployment(f), /paused/);
});

test('preparation computes PATCH from the formal Release and preserves an administrator version override', async () => {
  const f = fixture();
  f.after = { ...f.before };
  await control.prepareUpdate(f, 51);
  assert.equal(f.after.version, '0.1.1');
  assert.match(f.pr.body, /^Release-Version: v0.1.1/m);
  assert.equal(f.writes.filter((w) => w.path === 'package.json').length, 1);
  f.after.version = '0.2.0';
  await control.prepareUpdate(f, 51);
  assert.match(f.pr.body, /^Release-Version: v0.2.0/m);
  f.release = { tag_name: 'v0.2.0' };
  await control.prepareUpdate(f, 51);
  assert.equal(f.after.version, '0.2.1');
  f.permission = 'write';
  await assert.rejects(control.prepareUpdate(f, 51), /administrator/);
});

test('audit reconciliation rejects non-admin and stale labels and records the exact current event once', async () => {
  const f = fixture();
  verified(f);
  delete f.state.lease.approval;
  await control.reconcileApproval(f);
  assert.equal(f.state.lease.approval.eventId, 7);
  assert.equal(f.comments.length, 1);
  await control.reconcileApproval(f);
  assert.equal(f.comments.length, 1);
  f.events[0].id = 8;
  f.permission = 'write';
  await control.reconcileApproval(f);
  assert.equal(f.state.lease.approval, undefined);
  assert.equal(f.pr.labels.length, 0);
  f.pr.labels = [{ name: policy.APPROVAL_LABEL }];
  f.main = 'new-main';
  await control.reconcileApproval(f);
  assert.equal(f.state.lease.phase, 'reserved');
  assert.equal(f.state.lease.validation, undefined);
});

test('feature releases block unresolved majors; holds expire at 30 days, bind the head, and alerts invalidate holds', async () => {
  const f = fixture();
  f.openPrs = [f.pr];
  const feature = { head: { sha: 'feature' } };
  await assert.rejects(policy.requireFeatureReady(f, feature), /#51/);
  await control.deferUpdate(f, 51, 'Major migration needs compatibility work.');
  await policy.requireFeatureReady(f, feature);
  const hold = f.state.deferrals[51];
  const start = Date.parse(hold.at);
  assert.equal(
    policy.validDeferral(hold, f.pr, start + 30 * policy.DAY - 1),
    true,
  );
  assert.equal(
    policy.validDeferral(hold, f.pr, start + 30 * policy.DAY),
    false,
  );
  f.pr.head.sha = 'changed';
  await assert.rejects(policy.requireFeatureReady(f, feature), /#51/);
  f.pr.head.sha = 'head';
  f.alerts = [{ state: 'open' }];
  await assert.rejects(policy.requireFeatureReady(f, feature), /#51/);
  f.alerts = [];
  f.alertError = Object.assign(Error('Forbidden'), { status: 403 });
  await assert.rejects(policy.requireFeatureReady(f, feature), /Forbidden/);
  await assert.rejects(
    control.deferUpdate(f, 51, hold.reason),
    /new, nonempty/,
  );
  await control.deferUpdate(f, 51, '', true);
  assert.equal(f.state.deferrals[51], undefined);
});

test('unsynced main and PR listing failures cannot pass feature release gates', async () => {
  const f = fixture();
  f.comparison = 'diverged';
  await assert.rejects(
    policy.requireFeatureReady(f, { head: { sha: 'old' } }),
    /current main/,
  );
  f.comparison = 'ahead';
  f.github.paginate = async () => {
    throw Error('API unavailable');
  };
  await assert.rejects(
    policy.requireFeatureReady(f, { head: { sha: 'new' } }),
    /API unavailable/,
  );
});

function published(f) {
  const record = {
    environment: 'production',
    result: 'success',
    sha: 'published',
    runId: '100',
    release: { version: 'v0.1.1' },
    cloudflare: { deploymentId: 'deployment', versionId: 'version' },
    pr: { number: 51, headSha: 'head' },
  };
  f.publishedSha = 'published';
  f.release = {
    tag_name: 'v0.1.1',
    html_url: 'https://github.com/release',
    body: '## デプロイ記録\n\n```json\n' + JSON.stringify(record) + '\n```',
  };
}

test('sync uses only the published commit, is idempotent, updates one PR and never resets development', async () => {
  const f = fixture();
  published(f);
  f.main = 'unpublished-main';
  await sync.syncPublished(f);
  await sync.syncPublished(f);
  assert.equal(f.syncPrs.length, 1);
  assert.equal(f.refs[`heads/${sync.SYNC_BRANCH}`], 'published');
  assert.equal(f.syncPrs[0].base, 'cloudflare-migration');
  assert.equal(
    f.writes.some((w) =>
      /heads\/(main|cloudflare-migration)$/.test(w.ref || ''),
    ),
    false,
  );
  assert.equal(
    f.writes.some((w) => w.force === true),
    false,
  );
  f.comparison = 'ahead';
  f.publishedSha = 'next-published';
  const record = JSON.parse(f.release.body.match(/```json\n(.*)\n```/)[1]);
  record.sha = 'next-published';
  f.release.body =
    '## デプロイ記録\n\n```json\n' + JSON.stringify(record) + '\n```';
  // Development comparison is divergent; old published -> new published is ahead.
  f.github.rest.repos.compareCommits = async ({ head }) =>
    response({
      status: head === 'cloudflare-migration' ? 'diverged' : 'ahead',
    });
  await sync.syncPublished(f);
  assert.equal(f.syncPrs.length, 1);
  assert.equal(f.refs[`heads/${sync.SYNC_BRANCH}`], 'next-published');
});

test('publication failure, malformed provenance and already-synced code create no sync PR', async () => {
  const f = fixture();
  published(f);
  f.jobs = ['Deploy'];
  await assert.rejects(sync.syncPublished(f), /both succeed/);
  assert.equal(f.syncPrs.length, 0);
  f.jobs.push('Publish Release');
  f.publishedSha = 'other';
  await assert.rejects(sync.syncPublished(f), /successfully published/);
  published(f);
  f.comparison = 'ahead';
  await sync.syncPublished(f);
  assert.equal(f.syncPrs.length, 0);
});

test('all staging writers use a non-cancelling shared lock; privileged governance executes only main metadata code', async () => {
  const cloudflare = await readFile('.github/workflows/cloudflare.yml', 'utf8');
  const governance = await readFile(
    '.github/workflows/dependency-governance.yml',
    'utf8',
  );
  assert.match(cloudflare, /shared-staging/);
  assert.match(governance, /group: shared-staging\s+cancel-in-progress: false/);
  assert.match(cloudflare, /selectDeployment/);
  assert.match(cloudflare, /finishDeployment/);
  assert.match(governance, /ref: main/);
  assert.doesNotMatch(governance, /pnpm|head\.sha|wrangler|e2e:staging/);
  assert.match(governance, /cron: '17 \* \* \* \*'/);
  assert.match(cloudflare, /needs: \[deploy, release\]/);
});

test('running staging identity is verified, so an out-of-band overwrite cannot authorize release', async () => {
  const f = fixture();
  verified(f);
  f.runningSha = 'overwritten';
  await assert.rejects(
    policy.requireUpdateEvidence(f, f.pr),
    /no longer matches/,
  );
  f.request = async () => ({ ok: false });
  await assert.rejects(policy.requireUpdateEvidence(f, f.pr), /Cannot verify/);
});

test('state writes use compare-and-swap through fast-forward history and reject a stale concurrent writer', async () => {
  const f = fixture();
  const first = await readState(f),
    second = await readState(f);
  const parents = new Map();
  let index = 0;
  f.github.rest.git.createCommit = async ({ parents: list }) => {
    const sha = `cas-${++index}`;
    parents.set(sha, list[0]);
    return response({ sha });
  };
  const update = f.github.rest.git.updateRef;
  f.github.rest.git.updateRef = async (args) => {
    assert.equal(args.force, false);
    if (parents.get(args.sha) !== f.revision) throw Error('Non-fast-forward');
    return update(args);
  };
  first.lease = { pr: 51 };
  await writeState(f, first);
  second.lease = { pr: 99 };
  await assert.rejects(writeState(f, second), /Non-fast-forward/);
  assert.equal(f.state.lease.pr, 51);
});

test('refresh marks known heads pending and then fails closed on reconciliation/API errors', async () => {
  const f = fixture();
  f.openPrs = [f.pr];
  verified(f);
  f.github.rest.pulls.get = async () => {
    throw Error('API unavailable');
  };
  await control.refreshGates(f);
  assert.deepEqual(
    f.statuses.map((s) => s.state),
    ['pending', 'failure'],
  );
  assert.match(f.statuses[1].description, /API unavailable/);
});

test('setup preserves existing protection and development environment policy and verifies enabled settings', async () => {
  const f = fixture();
  const calls = [];
  const policies = [{ name: 'cloudflare-migration', type: 'branch' }];
  let ruleset = {
    id: 1,
    name: 'main',
    target: 'branch',
    source_type: 'Repository',
    enforcement: 'active',
    conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } },
    bypass_actors: [],
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [
            { context: 'PR checks' },
            { context: 'Formatting' },
          ],
        },
      },
    ],
  };
  f.github.request = async (path) => {
    calls.push(path);
    return response({ enabled: true });
  };
  Object.assign(f.github.rest.repos, {
    getEnvironment: async () =>
      response({
        deployment_branch_policy: {
          protected_branches: false,
          custom_branch_policies: true,
        },
      }),
    listDeploymentBranchPolicies: 'branch-policies',
    createDeploymentBranchPolicy: async (args) => {
      policies.push(args);
    },
    getRepoRulesets: 'rulesets',
    getRepoRuleset: async () => response(ruleset),
    updateRepoRuleset: async (args) => {
      calls.push(args);
      ruleset = { ...ruleset, ...args };
    },
  });
  Object.assign(f.github.rest.issues, {
    getLabel: async () => notFound(),
    createLabel: async (args) => calls.push(args),
  });
  const paginate = f.github.paginate;
  f.github.paginate = async (method, args) =>
    method === 'branch-policies'
      ? policies
      : method === 'rulesets'
        ? [ruleset]
        : paginate(method, args);
  const { setup } = (await import('../scripts/dependency-setup.cjs')).default;
  await setup(f);
  await setup(f);
  const checks = ruleset.rules.find(
    (r) => r.type === 'required_status_checks',
  ).parameters;
  assert.equal(checks.strict_required_status_checks_policy, true);
  assert.equal(checks.required_status_checks.length, 4);
  assert.deepEqual(ruleset.bypass_actors, []);
  assert.ok(ruleset.rules.some((r) => r.type === 'deletion'));
  assert.deepEqual(
    policies.map((p) => p.name),
    ['cloudflare-migration', 'main'],
  );
  assert.ok(
    calls.includes('PUT /repos/{owner}/{repo}/automated-security-fixes'),
  );
  f.permission = 'write';
  await assert.rejects(setup(f), /administrator/);
});

test('failed validation/restoration retains ownership and only verified matching deployment can complete it', async () => {
  const f = fixture();
  const selection = await control.selectDeployment(f, {
    action: 'validate-update',
    number: 51,
  });
  const record = {
    result: 'success',
    sha: 'head',
    runId: '99',
    verifiedAt: '2026-10-22T00:00:00Z',
    cloudflare: { deploymentId: 'cf', versionId: 'cf-version' },
    actionsUrl: 'https://github.com/actions/runs/99',
  };
  await assert.rejects(
    control.finishDeployment(f, selection, { ...record, result: 'failure' }),
    /Successful deployment/,
  );
  assert.equal(f.state.lease.phase, 'validating');
  await control.finishDeployment(f, selection, record);
  assert.equal(f.state.lease.phase, 'verified');
  assert.equal(f.state.lease.validation.cloudflareVersionId, 'cf-version');
  const restore = await control.selectDeployment(f, { action: 'abort-update' });
  await assert.rejects(
    control.finishDeployment(f, restore, record),
    /Successful deployment/,
  );
  assert.equal(f.state.lease.phase, 'restoring');
  await control.finishDeployment(f, restore, { ...record, sha: 'dev' });
  assert.equal(f.state.lease, null);
});

test('a failed merged update can be revalidated after an explicit abort, with its original base and fresh approval', async () => {
  const f = fixture();
  f.main = 'merge';
  f.context.sha = 'merge';
  f.pr.state = 'closed';
  f.pr.merged_at = '2026-10-22';
  f.pr.merge_commit_sha = 'merge';
  const result = await control.selectDeployment(f, {
    action: 'validate-update',
    number: 51,
  });
  assert.equal(result.sha, 'head');
  assert.equal(f.state.lease.base, 'main');
  assert.equal(f.state.lease.controller, 'merge');
  assert.equal(f.state.lease.approval, undefined);
  f.main = 'new-main';
  await assert.rejects(
    control.selectDeployment(f, { action: 'validate-update', number: 51 }),
    /current main release PR/,
  );
});

test('existing override versions may advance while override targets and unrelated policy stay protected', () => {
  const before = {
    packageManager: 'pnpm@11.25.0',
    overrides: { miniflare: { sharp: '0.35.4' } },
  };
  policy.validatePackageChange(before, {
    ...before,
    overrides: { miniflare: { sharp: '0.35.5' } },
  });
  assert.throws(() =>
    policy.validatePackageChange(before, {
      ...before,
      overrides: { other: '1.0.0' },
    }),
  );
  const workspace =
    'minimumReleaseAge: 10080\noverrides:\n  miniflare>sharp: 0.35.4\n';
  assert.equal(
    policy.validateWorkspaceChange(
      workspace,
      workspace.replace('0.35.4', '0.35.5'),
    ),
    false,
  );
  assert.throws(() =>
    policy.validateWorkspaceChange(
      workspace,
      workspace.replace('miniflare>sharp', 'other'),
    ),
  );
});
