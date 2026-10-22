const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} = require('node:fs');
const { checkProduction } = require('./deployment-policy.cjs');
const { validateRelease } = require('./release-policy.cjs');

const recordPath = '.release-runtime/record.json';
const digest = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

function saveRecord(record) {
  mkdirSync('.release-runtime', { recursive: true });
  writeFileSync(recordPath, JSON.stringify(record, null, 2) + '\n');
}

async function prepareRecord({ github, context, selection }) {
  const production = selection
    ? selection.kind === 'production'
    : context.ref === 'refs/heads/main';
  if (
    !production &&
    !selection &&
    context.ref !== 'refs/heads/cloudflare-migration'
  )
    throw Error('Unsupported deployment branch.');
  let pr = null,
    staging = null,
    release = null;
  if (production) {
    ({ pr, staging } = await checkProduction({ github, context }));
    release = await validateRelease({ github, context, pr, production: true });
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const changedMigrations = pr
    ? (
        await github.paginate(github.rest.pulls.listFiles, {
          ...context.repo,
          pull_number: pr.number,
          per_page: 100,
        })
      )
        .filter((file) => /^drizzle\/.*\.sql$/.test(file.filename))
        .map((file) => ({ name: file.filename, status: file.status }))
    : [];
  const record = {
    environment: production ? 'production' : 'staging',
    sha: selection?.sha || context.sha,
    runId: String(context.runId),
    runAttempt: String(process.env.GITHUB_RUN_ATTEMPT),
    actionsUrl: `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}/attempts/${process.env.GITHUB_RUN_ATTEMPT}`,
    builtAt: new Date().toISOString(),
    release,
    staging,
    changedMigrations,
    pr: pr
      ? {
          number: pr.number,
          headSha: pr.head.sha,
          references: pr.body?.match(/^Refs #\d+(?:, #\d+)*\s*$/gm) || [],
        }
      : null,
    sourceIssues:
      !production && selection?.kind !== 'update'
        ? [
            ...new Set(
              execFileSync('git', ['log', 'origin/main..HEAD', '--format=%B'], {
                encoding: 'utf8',
              }).match(/^Refs #\d+(?:, #\d+)*\s*$/gm) || [],
            ),
          ]
        : [],
    toolchain: {
      node: execFileSync('node', ['--version'], { encoding: 'utf8' }).trim(),
      packageManager: pkg.packageManager,
    },
    lockfileSha256: digest('pnpm-lock.yaml'),
    migrations: readdirSync('drizzle')
      .filter((name) => name.endsWith('.sql'))
      .sort()
      .map((name) => ({ name, sha256: digest(`drizzle/${name}`) })),
    result: 'prepared',
  };
  saveRecord(record);
  return record;
}

module.exports = { recordPath, digest, saveRecord, prepareRecord };
