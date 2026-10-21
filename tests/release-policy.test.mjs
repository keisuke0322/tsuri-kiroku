import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import policy from '../scripts/release-policy.cjs';

const { parseRelease, compareVersions, validateRelease, publishRelease } =
  policy;
const sha = 'a'.repeat(40);
const appTag = `v${JSON.parse(await readFile('package.json', 'utf8')).version}`;
const body =
  'Release-Version: v0.1.0\n\n### DB変更・復旧\n\nDB変更なし。旧Workerと互換性あり。\n\n## 検証\n成功';
const notFound = () => {
  throw Object.assign(Error('Not found'), { status: 404 });
};

function fixture() {
  let tag = null,
    release = null;
  const calls = [];
  const context = {
    repo: { owner: 'owner', repo: 'repo' },
    sha,
    ref: 'refs/heads/main',
    runId: 123,
  };
  const record = {
    environment: 'production',
    sha,
    runId: '123',
    runAttempt: '1',
    result: 'success',
    cloudflare: { deploymentId: 'deployment', versionId: 'worker-version' },
    release: { version: 'v0.1.0', dbNotes: 'DB変更なし。', previousTag: null },
    pr: { number: 49, references: ['Refs #49'] },
    staging: { sha: 'b'.repeat(40) },
  };
  const github = {
    rest: {
      git: {
        getRef: async () =>
          tag ? { data: { object: { type: 'commit', sha: tag } } } : notFound(),
        createRef: async (args) => {
          calls.push(['tag', args]);
          tag = args.sha;
        },
      },
      repos: {
        getLatestRelease: async () =>
          release ? { data: release } : notFound(),
        getReleaseByTag: async () => (release ? { data: release } : notFound()),
        generateReleaseNotes: async (args) => {
          calls.push(['notes', args]);
          return { data: { body: '* Feature #49' } };
        },
        createRelease: async (args) => {
          calls.push(['release', args]);
          release = args;
          return { data: release };
        },
      },
    },
  };
  return {
    github,
    context,
    record,
    calls,
    pr: { body: body.replace('v0.1.0', appTag) },
    setTag: (value) => {
      tag = value;
    },
    setRelease: (value) => {
      release = value;
    },
  };
}

test('PR specifies one valid version and DB/rollback notes; next headings are excluded', () => {
  assert.deepEqual(parseRelease(body), {
    version: 'v0.1.0',
    dbNotes: 'DB変更なし。旧Workerと互換性あり。',
  });
  for (const invalid of [
    '',
    body + '\nRelease-Version: v0.2.0',
    body.replace('v0.1.0', 'v01.1.0'),
    body.replace('v0.1.0', 'v0.1.0-rc.1'),
    'Release-Version: v0.1.0',
    'Release-Version: v0.1.0\n### DB変更・復旧\n<!-- TODO -->',
  ])
    assert.throws(() => parseRelease(invalid));
});

test('version order is numeric and rejects non-release formats', () => {
  assert.equal(compareVersions('v1.10.0', 'v1.9.9'), 1);
  assert.equal(compareVersions('v1.0.0', 'v1.0.0'), 0);
  assert.equal(compareVersions('v0.9.0', 'v1.0.0'), -1);
  assert.throws(() => compareVersions('latest', 'v1.0.0'));
});

test('preflight validates package version, first release, older versions and reused tags', async () => {
  const f = fixture();
  assert.equal((await validateRelease(f)).version, appTag);
  await assert.rejects(
    validateRelease({ ...f, pr: { body: body.replace('v0.1.0', 'v9.0.0') } }),
    /package.json/,
  );
  f.github.rest.repos.getLatestRelease = async () => ({
    data: { tag_name: 'v999999.0.0' },
  });
  await assert.rejects(validateRelease(f), /greater/);
  f.setTag(sha);
  await assert.rejects(validateRelease(f), /tag already exists/);
  f.setTag('other');
  await assert.rejects(
    validateRelease({ ...f, production: true }),
    /tag already exists/,
  );
});

test('network/permission failures are not treated as an empty release history', async () => {
  const f = fixture();
  f.github.rest.repos.getLatestRelease = async () => {
    throw Object.assign(Error('Forbidden'), { status: 403 });
  };
  await assert.rejects(validateRelease(f), /Forbidden/);
});

test('successful production record creates one immutable tag and Release with provenance', async () => {
  const f = fixture();
  await publishRelease(f);
  assert.deepEqual(
    f.calls.map(([kind]) => kind),
    ['tag', 'notes', 'release'],
  );
  const published = f.calls.at(-1)[1];
  assert.equal(published.target_commitish, sha);
  assert.match(published.body, /Refs #49/);
  assert.match(published.body, /DB変更なし/);
  assert.match(published.body, /"deploymentId": "deployment"/);
  assert.match(published.body, new RegExp(f.record.staging.sha));
  await publishRelease(f);
  assert.equal(f.calls.length, 3);
});

test('partial publication failure retries the same tag without deploying again', async () => {
  const f = fixture();
  const create = f.github.rest.repos.createRelease;
  f.github.rest.repos.createRelease = async () => {
    throw Error('Temporary failure');
  };
  await assert.rejects(publishRelease(f), /Temporary failure/);
  f.github.rest.repos.createRelease = create;
  await publishRelease(f);
  assert.equal(f.calls.filter(([kind]) => kind === 'tag').length, 1);
  assert.equal(f.calls.filter(([kind]) => kind === 'release').length, 1);
});

test('wrong environment, run, SHA, failed or incomplete record never creates a tag', async () => {
  for (const change of [
    { environment: 'staging' },
    { result: 'failure' },
    { sha: 'other' },
    { runId: '999' },
    { cloudflare: null },
    { staging: null },
  ]) {
    const f = fixture();
    await assert.rejects(
      publishRelease({ ...f, record: { ...f.record, ...change } }),
      /verified production/,
    );
    assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  f.context.ref = 'refs/heads/cloudflare-migration';
  await assert.rejects(publishRelease(f), /verified production/);
});

test('existing tags and conflicting Releases are never overwritten', async () => {
  const f = fixture();
  f.setTag('different-commit');
  await assert.rejects(publishRelease(f), /move a tag/);
  f.setTag(sha);
  f.setRelease({ draft: true, body: '' });
  await assert.rejects(publishRelease(f), /does not match/);
  assert.equal(f.calls.length, 0);
});

test('retrying an older release does not replace a newer latest release', async () => {
  const f = fixture();
  f.github.rest.repos.getLatestRelease = async () => ({
    data: { tag_name: 'v1.0.0' },
  });
  await publishRelease(f);
  assert.equal(f.calls.at(-1)[1].make_latest, 'false');
});

test('workflow gates publication on successful production, preserves records and waits before closing Issues', async () => {
  const workflow = await readFile('.github/workflows/cloudflare.yml', 'utf8');
  assert.match(
    workflow,
    /if: needs\.deploy\.result == 'success' && github\.ref == 'refs\/heads\/main'/,
  );
  assert.match(workflow, /needs: \[deploy, release\]/);
  assert.match(workflow, /needs\.release\.result == 'success'/);
  assert.match(workflow, /record-artifact:.*steps\.record-name\.outputs\.name/);
  assert.match(
    workflow,
    /name: \$\{\{ needs\.deploy\.outputs\.record-artifact \}\}/,
  );
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /DEPLOYMENT_RESULT: \$\{\{ job.status \}\}/);
});
