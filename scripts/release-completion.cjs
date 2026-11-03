const { getDevelopmentBranch } = require('./development-branch.cjs');
const { readState } = require('./dependency-state.cjs');
const { publishedRelease } = require('./dependency-sync.cjs');
const { references, setStatus } = require('./issue-status.cjs');

// A successful production publish is only one part of completing the release.
// Read trusted main code and GitHub evidence; never execute workflow_run sources.
async function completeReleases({ github, context, log = () => {} }) {
  const options = { github, context };
  const state = await readState(options);
  if (state.lease) return { state: 'waiting-for-staging-restoration' };
  const { name: developmentBranch, data: development } =
    await getDevelopmentBranch(options);
  const sha = development.object.sha;
  const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
    ...context.repo,
    workflow_id: 'cloudflare.yml',
    branch: developmentBranch,
    head_sha: sha,
    event: 'push',
    per_page: 100,
  });
  let run = runs
    .filter(
      (r) =>
        r.head_sha === sha &&
        r.event === 'push' &&
        r.head_branch === developmentBranch,
    )
    .sort((a, b) => b.id - a.id)[0];
  const restored = state.lastRestoration;
  const restoredAt = Date.parse(restored?.verifiedAt);
  const runAt = Date.parse(run?.updated_at || run?.created_at);
  const restorationIsNewer =
    !run ||
    (Number.isFinite(restoredAt) && Number.isFinite(runAt)
      ? restoredAt > runAt
      : Number(restored?.runId) > run.id);
  if (restored?.sha === sha && restorationIsNewer) {
    const { data } = await github.rest.actions.getWorkflowRun({
      ...context.repo,
      run_id: restored.runId,
    });
    if (
      data.head_sha !== restored.controller ||
      data.event !== 'workflow_dispatch' ||
      String(data.run_attempt) !== String(restored.runAttempt)
    )
      throw Error('Restoration run identity changed.');
    run = data;
  }
  if (
    !run ||
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    run.path !== '.github/workflows/cloudflare.yml'
  )
    return { state: 'waiting-for-development-staging' };
  const jobs = await github.paginate(
    github.rest.actions.listJobsForWorkflowRun,
    {
      ...context.repo,
      run_id: run.id,
      filter: 'latest',
      per_page: 100,
    },
  );
  if (
    !jobs.some((job) => job.name === 'Deploy' && job.conclusion === 'success')
  )
    return { state: 'waiting-for-development-staging' };
  const releases = await github.paginate(github.rest.repos.listReleases, {
    ...context.repo,
    per_page: 100,
  });
  const completed = [];
  for (const release of releases.filter((r) => !r.draft && !r.prerelease)) {
    // Pre-provenance releases are outside this lifecycle.
    if (!release.body?.includes('## デプロイ記録')) continue;
    const { record } = await publishedRelease(options, release);
    const { data: comparison } = await github.rest.repos.compareCommits({
      ...context.repo,
      base: record.sha,
      head: sha,
      per_page: 1,
    });
    if (!['ahead', 'identical'].includes(comparison.status)) continue;
    const { data: pr } = await github.rest.pulls.get({
      ...context.repo,
      pull_number: record.pr.number,
    });
    if (
      !pr.merged_at ||
      pr.merge_commit_sha !== record.sha ||
      pr.base.ref !== 'main'
    )
      throw Error('Published release PR does not match its merge.');
    // Readiness must still hold immediately before changing Issue status.
    const current = await readState(options);
    const { data: branch } = await github.rest.git.getRef({
      ...context.repo,
      ref: `heads/${developmentBranch}`,
    });
    if (current.lease || branch.object.sha !== sha)
      return { state: 'development-changed', completed };
    for (const number of references((record.pr.references || []).join('\n'))) {
      const { data: issue } = await github.rest.issues.get({
        ...context.repo,
        issue_number: number,
      });
      if (issue.state === 'closed') continue;
      await setStatus({ github, context, number, status: '完了', log });
      completed.push(number);
    }
  }
  return {
    state: 'completed',
    completed,
    developmentSha: sha,
    stagingRun: run.id,
  };
}

module.exports = { completeReleases };
