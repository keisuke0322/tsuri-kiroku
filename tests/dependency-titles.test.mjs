import test from 'node:test';
import assert from 'node:assert/strict';
import titles from '../scripts/dependency-titles.cjs';

const commit = (dependencies) => ({
  author: { login: 'dependabot[bot]' },
  commit: {
    verification: { verified: true },
    message: `Bump dependencies\n\n---\nupdated-dependencies:\n${dependencies.map(([name, type]) => `- dependency-name: '${name}'\n  dependency-type: indirect\n${type ? `  update-type: version-update:semver-${type}\n` : ''}`).join('')}...\nSigned-off-by: dependabot[bot]`,
  },
});

function fixture(type = 'patch') {
  const pr = {
    number: 10,
    title: 'Bump example from 1.0.0 to 1.0.1',
    state: 'open',
    base: { ref: 'main', sha: 'base' },
    head: { ref: 'dependabot/npm/example', sha: 'head' },
    user: { login: 'dependabot[bot]', type: 'Bot' },
    body: '',
  };
  const f = {
    pr,
    commits: [commit([['example', type]])],
    alerts: [],
    updates: [],
    context: { repo: { owner: 'owner', repo: 'repo' } },
    before: { dependencies: { example: '^1.0.0' } },
    after: { dependencies: { example: '^2.0.0' } },
  };
  f.github = {
    rest: {
      pulls: {
        listCommits: 'commits',
        update: async (args) => {
          f.updates.push(args);
          Object.assign(pr, args);
        },
      },
      repos: {
        getContent: async ({ ref }) => ({
          data: {
            type: 'file',
            encoding: 'base64',
            content: Buffer.from(
              JSON.stringify(ref === 'base' ? f.before : f.after),
            ).toString('base64'),
          },
        }),
      },
    },
    paginate: async (method) => {
      if (method === 'commits') return f.commits;
      if (typeof method === 'string' && method.includes('dependabot/alerts')) {
        if (f.alertError) throw f.alertError;
        return f.alerts;
      }
      throw Error('Unexpected API');
    },
  };
  return f;
}

for (const [type, prefix] of [
  ['major', '[通常・メジャー]'],
  ['minor', '[通常・マイナー／パッチ]'],
  ['patch', '[通常・マイナー／パッチ]'],
])
  test(`verified Dependabot ${type} is visible in the PR title`, async () => {
    const f = fixture(type);
    assert.equal(
      await titles.classifiedTitle(f, f.pr),
      `${prefix} ${f.pr.title}`,
    );
  });

test('a group with any major update is classified major and includes scoped packages', async () => {
  const f = fixture();
  f.commits = [
    commit([
      ['@scope/one', 'patch'],
      ['example', 'major'],
    ]),
  ];
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[通常・メジャー\]/);
  assert.deepEqual(titles.metadataFromCommits(f.commits).names, [
    '@scope/one',
    'example',
  ]);
});

test('unresolved security alerts or an explicit emergency reason mark the update urgent', async () => {
  const f = fixture('major');
  f.alerts = [{ dependency: { package: { name: 'example' } } }];
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[緊急\]/);
  f.alerts = [{ dependency: { package: { name: 'unrelated' } } }];
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[通常・メジャー\]/);
  f.pr.body = 'Emergency-Reason: Fix the broken build immediately.';
  f.alertError = Error('Unavailable');
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[緊急\]/);
});

test('missing metadata, unverified commits and unavailable security data never claim a normal update', async () => {
  const f = fixture();
  f.commits[0].commit.verification.verified = false;
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[要確認\]/);
  f.commits = [commit([['example', 'patch']])];
  f.alertError = Error('Forbidden');
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[要確認\]/);
  f.alertError = null;
  f.commits = [
    commit([
      ['example', 'patch'],
      ['unknown', null],
    ]),
  ];
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[要確認\]/);
});

test('the administrator preparation commit does not hide verified dependency metadata', async () => {
  const f = fixture('major');
  f.commits.push({
    author: { login: 'admin' },
    commit: {
      message: 'chore: prepare app release v0.1.5',
      verification: { verified: true },
    },
  });
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[通常・メジャー\]/);
});

test('manual updates classify numeric manifest changes conservatively', async () => {
  const f = fixture();
  f.pr.user = { login: 'admin', type: 'User' };
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[通常・メジャー\]/);
  f.after.dependencies.example = '^1.0.1';
  assert.match(
    await titles.classifiedTitle(f, f.pr),
    /^\[通常・マイナー／パッチ\]/,
  );
  f.after.dependencies.unknown = 'git:example';
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[要確認\]/);
});

test('classification is idempotent, replaces old categories and leaves feature PRs alone', async () => {
  const f = fixture();
  await titles.refreshDependabotTitle(f, f.pr);
  await titles.refreshDependabotTitle(f, f.pr);
  assert.equal(f.updates.length, 1);
  f.commits = [commit([['example', 'major']])];
  await titles.refreshDependabotTitle(f, f.pr);
  assert.match(f.pr.title, /^\[通常・メジャー\] Bump/);
  assert.equal(f.pr.title.includes('[通常・マイナー／パッチ]'), false);
  f.pr.user = { login: 'admin', type: 'User' };
  await titles.refreshDependabotTitle(f, f.pr);
  assert.equal(f.updates.length, 2);
  assert.ok(
    Array.from(titles.titleWithCategory('x'.repeat(300), '緊急')).length <= 256,
  );
});

test('indirect Dependabot updates without update-type retain verified version classification', async () => {
  const f = fixture();
  f.commits = [commit([['zod', null]])];
  f.commits[0].commit.message = f.commits[0].commit.message.replace(
    'Bump dependencies',
    'Bumps [zod](https://github.com/colinhacks/zod) from 3.25.76 to 4.6.7.',
  );
  assert.match(await titles.classifiedTitle(f, f.pr), /^\[通常・メジャー\]/);
});
