const { readFileSync } = require('node:fs');

const versionPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseRelease(body = '') {
  const lines = body.match(/^Release-Version: (.+)$/gm) || [];
  if (lines.length !== 1)
    throw Error('Specify one Release-Version: vMAJOR.MINOR.PATCH in the PR.');
  const version = lines[0].slice('Release-Version: '.length).trim();
  if (!versionPattern.test(version)) throw Error('Invalid release version.');
  const dbNotes = body
    .match(/^### DB変更・復旧\s*\n([\s\S]*?)(?=^#{1,3} |$(?![\s\S]))/m)?.[1]
    .trim();
  if (!dbNotes || /<!--|TODO|未記入/.test(dbNotes))
    throw Error(
      'Describe DB changes and rollback compatibility under ### DB変更・復旧.',
    );
  return { version, dbNotes };
}

function compareVersions(a, b) {
  if (!versionPattern.test(a) || !versionPattern.test(b))
    throw Error('Invalid release version.');
  const left = a.slice(1).split('.').map(BigInt);
  const right = b.slice(1).split('.').map(BigInt);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

async function optional(request) {
  try {
    return (await request()).data;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function tagCommit(github, repo, version) {
  const ref = await optional(() =>
    github.rest.git.getRef({ ...repo, ref: `tags/${version}` }),
  );
  if (!ref) return null;
  let object = ref.object;
  for (let depth = 0; object.type === 'tag' && depth < 10; depth++) {
    object = (await github.rest.git.getTag({ ...repo, tag_sha: object.sha }))
      .data.object;
  }
  if (object.type !== 'commit')
    throw Error('Release tag must resolve to a commit.');
  return object.sha;
}

async function validateRelease({ github, context, pr, production = false }) {
  const release = parseRelease(pr.body);
  const packageVersion = JSON.parse(
    readFileSync('package.json', 'utf8'),
  ).version;
  if (release.version !== `v${packageVersion}`)
    throw Error('Release-Version must match package.json version.');
  const latest = await optional(() =>
    github.rest.repos.getLatestRelease(context.repo),
  );
  const existing = await optional(() =>
    github.rest.repos.getReleaseByTag({
      ...context.repo,
      tag: release.version,
    }),
  );
  const commit = await tagCommit(github, context.repo, release.version);
  if (commit && (!production || commit !== context.sha))
    throw Error(
      'Release tag already exists at another commit or is already published.',
    );
  if (
    existing &&
    (!production || !commit || existing.draft || existing.prerelease)
  )
    throw Error('Release version is already in use.');
  if (
    latest &&
    compareVersions(release.version, latest.tag_name) <= 0 &&
    !existing
  )
    throw Error(
      'Release version must be greater than the latest published version.',
    );
  return {
    ...release,
    previousTag:
      latest?.tag_name === release.version ? null : latest?.tag_name || null,
  };
}

async function publishRelease({ github, context, record }) {
  if (
    context.ref !== 'refs/heads/main' ||
    record.environment !== 'production' ||
    record.sha !== context.sha ||
    record.runId !== String(context.runId) ||
    record.result !== 'success' ||
    !record.cloudflare?.deploymentId ||
    !record.cloudflare?.versionId ||
    !record.release?.version ||
    !record.pr?.number ||
    !record.staging?.sha
  )
    throw Error(
      'Release requires a verified production deployment record for this run.',
    );
  const { version, dbNotes, previousTag } = record.release;
  if (!versionPattern.test(version)) throw Error('Invalid release version.');
  const found = await tagCommit(github, context.repo, version);
  if (found && found !== context.sha)
    throw Error('Refusing to move a tag at another commit.');
  const existing = await optional(() =>
    github.rest.repos.getReleaseByTag({ ...context.repo, tag: version }),
  );
  if (existing) {
    if (
      !found ||
      existing.draft ||
      existing.prerelease ||
      !existing.body?.includes(`\"sha\": \"${record.sha}\"`)
    )
      throw Error('Existing Release does not match this production record.');
    return existing;
  }
  if (!found)
    await github.rest.git.createRef({
      ...context.repo,
      ref: `refs/tags/${version}`,
      sha: context.sha,
    });
  const notes = await github.rest.repos.generateReleaseNotes({
    ...context.repo,
    tag_name: version,
    target_commitish: context.sha,
    ...(previousTag ? { previous_tag_name: previousTag } : {}),
  });
  const latest = await optional(() =>
    github.rest.repos.getLatestRelease(context.repo),
  );
  const body = [
    notes.data.body,
    `## 公開PR\n\n#${record.pr.number}\n\n${record.pr.references.join('\n')}`,
    `## DB変更・復旧\n\n${dbNotes}\n\nWorkerのロールバックではDBは戻りません。`,
    '## デプロイ記録\n\n```json\n' + JSON.stringify(record, null, 2) + '\n```',
  ].join('\n\n');
  return (
    await github.rest.repos.createRelease({
      ...context.repo,
      tag_name: version,
      target_commitish: context.sha,
      name: version,
      body,
      draft: false,
      prerelease: false,
      make_latest:
        !latest || compareVersions(version, latest.tag_name) > 0
          ? 'true'
          : 'false',
    })
  ).data;
}

module.exports = {
  parseRelease,
  compareVersions,
  validateRelease,
  publishRelease,
};
