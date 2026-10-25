const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');

function syncCIRecord(event, environment) {
  const pr = event.pull_request;
  if (
    !/^[^/]+\/[^/]+$/.test(environment.GITHUB_REPOSITORY || '') ||
    !/^[1-9]\d*$/.test(String(pr?.number)) ||
    pr?.base?.ref !== 'cloudflare-migration' ||
    pr.head?.ref !== 'main' ||
    pr.head.repo?.full_name !== environment.GITHUB_REPOSITORY ||
    pr.base.repo?.full_name !== environment.GITHUB_REPOSITORY ||
    !/^[a-f0-9]{40}$/.test(pr.head.sha) ||
    !/^[a-f0-9]{40}$/.test(pr.base.sha) ||
    !/^[a-f0-9]{40}$/.test(environment.GITHUB_SHA || '') ||
    !/^\d+$/.test(environment.GITHUB_RUN_ID || '') ||
    !/^\d+$/.test(environment.GITHUB_RUN_ATTEMPT || '')
  )
    throw Error('Published sync CI identity is invalid.');
  return {
    pr: pr.number,
    repository: environment.GITHUB_REPOSITORY,
    head: pr.head.sha,
    base: pr.base.sha,
    merge: environment.GITHUB_SHA,
    runId: environment.GITHUB_RUN_ID,
    attempt: environment.GITHUB_RUN_ATTEMPT,
  };
}

if (require.main === module) {
  const record = syncCIRecord(
    JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
    process.env,
  );
  mkdirSync('.sync-ci', { recursive: true });
  writeFileSync('.sync-ci/record.json', JSON.stringify(record, null, 2) + '\n');
}

module.exports = { syncCIRecord };
