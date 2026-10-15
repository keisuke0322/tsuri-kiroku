const { STATES, setStatus } = require('./project-status.cjs');
// Only explicit local references are release targets; incidental #numbers are ignored.
function references(text = '') {
  const result = new Set();
  for (const line of text.split('\n')) {
    const match = line.match(
      /^\s*(?:Refs?|Closes?|Fix(?:es)?|Resolves?)\s+((?:#\d+[\s,]*)+)\s*$/i,
    );
    if (match)
      for (const number of match[1].matchAll(/#(\d+)/g))
        result.add(Number(number[1]));
  }
  return [...result];
}

// Classify the original author, never the actor editing/reopening the submission.
async function isExternal({ github, context, author }) {
  if (!author?.login) throw new Error('Submission author is missing');
  if (author.type === 'Bot' || author.login.endsWith('[bot]')) return false;
  const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
    ...context.repo,
    username: author.login,
  });
  return !['admin', 'maintain', 'write'].includes(data.permission);
}

async function updateEvent({ github, context, log }) {
  const issueEvent = context.eventName === 'issues';
  const submission = issueEvent
    ? context.payload.issue
    : context.payload.pull_request;
  if (!submission) throw new Error('Submission payload is missing');
  const external = await isExternal({
    github,
    context,
    author: submission.user,
  });
  if (external) {
    await github.rest.issues.addLabels({
      ...context.repo,
      issue_number: submission.number,
      labels: ['外部提案'],
    });
    await setStatus({
      github,
      context,
      number: submission.number,
      kind: issueEvent ? 'issue' : 'pullRequest',
      status: '外部提案',
      initial: true,
      log,
    });
    // Never use an external PR's Refs to update another Issue.
    return;
  }
  if (issueEvent) {
    return setStatus({
      github,
      context,
      number: submission.number,
      status: '検討中',
      initial: true,
      log,
    });
  }
  const pr = submission;
  if (
    pr.base.ref !== 'main' ||
    pr.head.ref !== 'cloudflare-migration' ||
    pr.head.repo?.full_name !== `${context.repo.owner}/${context.repo.repo}`
  )
    return;
  for (const number of references(pr.body)) {
    await setStatus({ github, context, number, status: '本番反映待ち', log });
  }
}

async function updateDeployment({ github, context, log }) {
  const targets = new Set();
  let status;
  const releaseTargets = new Set();
  if (context.ref === 'refs/heads/cloudflare-migration') {
    status = 'staging確認待ち';
    const { data } = await github.rest.repos.compareCommitsWithBasehead({
      ...context.repo,
      basehead: `main...${context.sha}`,
      per_page: 100,
    });
    // The REST comparison limits commits; never silently miss release targets.
    if (data.total_commits > data.commits.length)
      throw new Error('Too many commits to resolve Issue references');
    for (const commit of data.commits)
      for (const number of references(commit.commit.message))
        targets.add(number);
    const prs = await github.paginate(github.rest.pulls.list, {
      ...context.repo,
      state: 'open',
      base: 'main',
      head: `${context.repo.owner}:cloudflare-migration`,
      per_page: 100,
    });
    for (const pr of prs) {
      // Re-verify Project Status after staging, including PRs opened before this workflow was migrated.
      if (pr.head.sha === context.sha) {
        for (const number of references(pr.body)) {
          targets.add(number);
          releaseTargets.add(number);
        }
      }
    }
  } else if (context.ref === 'refs/heads/main') {
    status = '完了';
    const prs = await github.paginate(
      github.rest.repos.listPullRequestsAssociatedWithCommit,
      {
        ...context.repo,
        commit_sha: context.sha,
        per_page: 100,
      },
    );
    const pr = prs.find(
      (p) =>
        p.merged_at &&
        p.merge_commit_sha === context.sha &&
        p.base.ref === 'main' &&
        p.head.ref === 'cloudflare-migration',
    );
    if (!pr) throw new Error('No merged release PR at production commit');
    for (const number of references(pr.body)) targets.add(number);
  } else throw new Error('Unsupported deployment branch');
  for (const number of targets)
    await setStatus({
      github,
      context,
      number,
      status: releaseTargets.has(number) ? '本番反映待ち' : status,
      log,
    });
}

module.exports = {
  STATES,
  isExternal,
  references,
  setStatus,
  updateEvent,
  updateDeployment,
};
