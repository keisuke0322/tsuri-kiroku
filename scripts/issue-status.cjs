const STATES = ['検討中', '開発中', 'staging確認待ち', '本番反映待ち', '完了'];

// Only explicit local references are release targets; incidental #numbers are ignored.
function references(text = '') {
  const result = new Set();
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(?:Refs?|Closes?|Fix(?:es)?|Resolves?)\s+((?:#\d+[\s,]*)+)\s*$/i);
    if (match) for (const number of match[1].matchAll(/#(\d+)/g)) result.add(Number(number[1]));
  }
  return [...result];
}

async function setStatus({ github, context, number, status, initial = false }) {
  if (!STATES.includes(status)) throw new Error('Unknown issue status');
  const args = { ...context.repo, issue_number: number };
  const { data: issue } = await github.rest.issues.get(args);
  if (issue.pull_request) throw new Error(`#${number} is a PR, not an Issue`);
  const labels = issue.labels.map(l => typeof l === 'string' ? l : l.name);
  if (initial && labels.some(l => STATES.includes(l))) return;
  if (status !== '完了' && issue.state === 'closed') return;
  try {
    await github.rest.issues.getLabel({ ...context.repo, name: status });
  } catch (error) {
    if (error.status !== 404) throw error;
    try {
      await github.rest.issues.createLabel({ ...context.repo, name: status, color: status === '完了' ? '0E8A16' : '1D76DB' });
    } catch (error) { if (error.status !== 422) throw error; }
  }
  await github.rest.issues.addLabels({ ...args, labels: [status] });
  for (const name of labels.filter(l => STATES.includes(l) && l !== status)) {
    try { await github.rest.issues.removeLabel({ ...args, name }); }
    catch (error) { if (error.status !== 404) throw error; }
  }
  if (status === '完了' && issue.state !== 'closed') {
    await github.rest.issues.update({ ...args, state: 'closed', state_reason: 'completed' });
  }
}

async function updateEvent({ github, context }) {
  if (context.eventName === 'issues') {
    return setStatus({ github, context, number: context.issue.number, status: '検討中', initial: true });
  }
  const pr = context.payload.pull_request;
  if (pr.base.ref !== 'main' || pr.head.ref !== 'cloudflare-migration' ||
      pr.head.repo?.full_name !== `${context.repo.owner}/${context.repo.repo}`) return;
  for (const number of references(pr.body)) {
    await setStatus({ github, context, number, status: '本番反映待ち' });
  }
}

async function updateDeployment({ github, context }) {
  const targets = new Set();
  let status;
  if (context.ref === 'refs/heads/cloudflare-migration') {
    status = 'staging確認待ち';
    const { data } = await github.rest.repos.compareCommitsWithBasehead({
      ...context.repo, basehead: `main...${context.sha}`, per_page: 100,
    });
    // The REST comparison limits commits; never silently miss release targets.
    if (data.total_commits > data.commits.length) throw new Error('Too many commits to resolve Issue references');
    for (const commit of data.commits) for (const number of references(commit.commit.message)) targets.add(number);
    const prs = await github.paginate(github.rest.pulls.list, { ...context.repo, state: 'open', base: 'main', head: `${context.repo.owner}:cloudflare-migration`, per_page: 100 });
    for (const pr of prs) {
      // An existing release PR remains waiting for production after staging succeeds.
      for (const number of references(pr.body)) targets.delete(number);
    }
  } else if (context.ref === 'refs/heads/main') {
    status = '完了';
    const prs = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
      ...context.repo, commit_sha: context.sha, per_page: 100,
    });
    const pr = prs.find(p => p.merged_at && p.merge_commit_sha === context.sha && p.base.ref === 'main' && p.head.ref === 'cloudflare-migration');
    if (!pr) throw new Error('No merged release PR at production commit');
    for (const number of references(pr.body)) targets.add(number);
  } else throw new Error('Unsupported deployment branch');
  for (const number of targets) await setStatus({ github, context, number, status });
}
module.exports = { STATES, references, setStatus, updateEvent, updateDeployment };
