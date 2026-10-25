const { optional, currentMain } = require('./dependency-state.cjs');
const SYNC_BRANCH = 'main';

async function publishedRelease({ github, context }) {
  const { data: release } = await github.rest.repos.getLatestRelease(
    context.repo,
  );
  if (
    release.draft ||
    release.prerelease ||
    !/^v\d+\.\d+\.\d+$/.test(release.tag_name)
  )
    throw Error('Latest formal production Release is required.');
  const json = release.body?.match(
    /## デプロイ記録\s*\n\s*```json\n([\s\S]*?)\n```/,
  );
  if (!json) throw Error('Missing published deployment provenance.');
  const record = JSON.parse(json[1]);
  const { data: ref } = await github.rest.git.getRef({
    ...context.repo,
    ref: `tags/${release.tag_name}`,
  });
  if (
    ref.object.type !== 'commit' ||
    record.sha !== ref.object.sha ||
    record.environment !== 'production' ||
    record.result !== 'success' ||
    !record.cloudflare?.deploymentId ||
    !record.cloudflare?.versionId ||
    record.release?.version !== release.tag_name ||
    !record.pr?.headSha
  )
    throw Error(
      'Release does not identify a successfully published production commit.',
    );
  const { data: run } = await github.rest.actions.getWorkflowRun({
    ...context.repo,
    run_id: record.runId,
  });
  // The publish job can call this before its parent workflow finishes.
  if (
    run.path !== '.github/workflows/cloudflare.yml' ||
    run.head_sha !== record.sha
  )
    throw Error('Release provenance does not match the deployment workflow.');
  const jobs = await github.paginate(
    github.rest.actions.listJobsForWorkflowRun,
    {
      ...context.repo,
      run_id: record.runId,
      filter: 'latest',
      per_page: 100,
    },
  );
  if (
    !jobs.some((j) => j.name === 'Deploy' && j.conclusion === 'success') ||
    !jobs.some(
      (j) => j.name === 'Publish Release' && j.conclusion === 'success',
    )
  )
    throw Error('Production deployment and Release jobs must both succeed.');
  return { release, record };
}

async function syncPublished(options) {
  const { github, context } = options;
  const { release, record } = await publishedRelease(options);
  if ((await currentMain(options)) !== record.sha)
    return { state: 'waiting-for-publication' };
  const { data: development } = await github.rest.repos.compareCommits({
    ...context.repo,
    base: record.sha,
    head: 'cloudflare-migration',
    per_page: 100,
  });
  if (['ahead', 'identical'].includes(development.status)) return;
  const prs = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    state: 'open',
    base: 'cloudflare-migration',
    head: `${context.repo.owner}:${SYNC_BRANCH}`,
    per_page: 100,
  });
  if (prs.length > 1) throw Error('Multiple sync PRs found; resolve manually.');
  const body =
    `公開済み ${release.tag_name} (${record.sha}) を開発ブランチへ取り込みます。\n\n` +
    `本番デプロイ・稼働情報検証・Release作成成功済み: ${release.html_url}\n\n` +
    'mainの先端の本番デプロイ・Release作成と、最新の開発ブランチとのContribution checksが成功して競合がない場合は自動マージします。mainに追加変更が入った間は公開成功を待ちます。競合・CI失敗・開発baseの変更は手動で確認してください。開発中の変更は保持します。';
  const values = {
    ...context.repo,
    title: 'chore: sync main into development',
    body,
  };
  if (prs[0])
    await github.rest.pulls.update({ ...values, pull_number: prs[0].number });
  else
    await github.rest.pulls.create({
      ...values,
      head: SYNC_BRANCH,
      base: 'cloudflare-migration',
    });
}

async function autoMergePublishedSync(options) {
  const { github, context } = options;
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  if (context.ref !== 'refs/heads/main')
    throw Error('Run published sync automation from main.');
  const event = context.payload?.workflow_run;
  if (
    context.eventName === 'workflow_run' &&
    (event?.event !== 'pull_request' ||
      event.head_branch !== SYNC_BRANCH ||
      event.head_repository?.full_name !== repository ||
      event.path !== '.github/workflows/contribution-checks.yml')
  )
    return { state: 'ignored' };
  const prs = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    state: 'open',
    base: 'cloudflare-migration',
    head: `${context.repo.owner}:${SYNC_BRANCH}`,
    per_page: 100,
  });
  if (!prs.length) return { state: 'nothing-to-sync' };
  if (prs.length !== 1)
    throw Error('Multiple sync PRs found; resolve manually.');
  const { data: pr } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: prs[0].number,
  });
  const { record } = await publishedRelease(options);
  if (
    pr.state !== 'open' ||
    pr.draft ||
    pr.base?.ref !== 'cloudflare-migration' ||
    pr.head?.ref !== SYNC_BRANCH ||
    pr.base.repo?.full_name !== repository ||
    pr.head.repo?.full_name !== repository ||
    !pr.head.sha
  )
    throw Error(
      'Only the same-repository main to development sync PR is eligible.',
    );
  if (pr.head.sha !== record.sha || (await currentMain(options)) !== record.sha)
    return { state: 'waiting-for-publication', pr: pr.number };
  async function currentCI() {
    const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
      ...context.repo,
      workflow_id: 'contribution-checks.yml',
      head_sha: pr.head.sha,
      event: 'pull_request',
      per_page: 100,
    });
    return runs
      .filter(
        (item) =>
          item.head_sha === pr.head.sha &&
          item.head_branch === SYNC_BRANCH &&
          item.event === 'pull_request' &&
          item.path === '.github/workflows/contribution-checks.yml' &&
          item.repository?.full_name === repository &&
          item.head_repository?.full_name === repository &&
          item.pull_requests?.some((p) => p.number === pr.number),
      )
      .sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt)[0];
  }
  const run = await currentCI();
  if (!run || run.status !== 'completed')
    return { state: 'waiting-for-ci', pr: pr.number };
  if (run.conclusion !== 'success')
    throw Error('Latest sync Contribution checks failed; review manually.');
  const tested = run.pull_requests.find((p) => p.number === pr.number);
  if (tested.head?.sha !== pr.head.sha || tested.base?.sha !== pr.base.sha)
    throw Error(
      'Sync CI does not match the current head and development base; review manually.',
    );
  // Artifact names bind the immutable CI event's base, rather than relying
  // only on the PR association returned by GitHub after the base advances.
  const artifacts = await github.paginate(
    github.rest.actions.listWorkflowRunArtifacts,
    {
      ...context.repo,
      run_id: run.id,
      per_page: 100,
    },
  );
  const identity = `published-sync-ci-${run.id}-${run.run_attempt}-${pr.base.sha}`;
  if (
    artifacts.filter((a) => a.name === identity && a.expired === false)
      .length !== 1
  )
    throw Error('Missing exact tested sync base identity; review manually.');
  const { data: current } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: pr.number,
  });
  const { data: development } = await github.rest.git.getRef({
    ...context.repo,
    ref: 'heads/cloudflare-migration',
  });
  const { data: source } = await github.rest.git.getRef({
    ...context.repo,
    ref: `heads/${SYNC_BRANCH}`,
  });
  const latest = await publishedRelease(options);
  const confirmed = await currentCI();
  if (
    source.object.sha !== record.sha ||
    latest.record.sha !== record.sha ||
    current.head.sha !== pr.head.sha
  )
    return { state: 'waiting-for-publication', pr: pr.number };
  if (
    current.state !== 'open' ||
    current.base?.ref !== 'cloudflare-migration' ||
    current.head?.ref !== SYNC_BRANCH ||
    current.base?.repo?.full_name !== repository ||
    current.head?.repo?.full_name !== repository ||
    confirmed?.id !== run.id ||
    confirmed?.run_attempt !== run.run_attempt ||
    confirmed?.status !== 'completed' ||
    confirmed?.conclusion !== 'success' ||
    current.draft ||
    current.mergeable !== true ||
    current.base.sha !== pr.base.sha ||
    development.object.sha !== tested.base.sha ||
    latest.record.sha !== record.sha
  )
    throw Error(
      'Sync branches, release or mergeability changed; review manually.',
    );
  const { data: merged } = await github.rest.pulls.merge({
    ...context.repo,
    pull_number: pr.number,
    sha: pr.head.sha,
    merge_method: 'merge',
  });
  if (!merged.merged)
    throw Error('Published sync was not merged; review manually.');
  return { state: 'merged', pr: pr.number, sha: merged.sha };
}

async function cleanupMerged(options) {
  const { github, context } = options;
  const { record } = await publishedRelease(options);
  const prs = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    state: 'closed',
    base: 'main',
    per_page: 100,
  });
  for (const pr of prs) {
    if (
      !pr.merged_at ||
      pr.user?.login !== 'dependabot[bot]' ||
      !pr.head.ref.startsWith('dependabot/') ||
      pr.head.repo?.full_name !== `${context.repo.owner}/${context.repo.repo}`
    )
      continue;
    const { data } = await github.rest.repos.compareCommits({
      ...context.repo,
      base: pr.merge_commit_sha,
      head: record.sha,
      per_page: 100,
    });
    if (!['ahead', 'identical'].includes(data.status)) continue;
    const ref = await optional(() =>
      github.rest.git.getRef({ ...context.repo, ref: `heads/${pr.head.ref}` }),
    );
    // Never delete a branch that has advanced since the reviewed merge.
    if (ref?.object.sha === pr.head.sha)
      await github.rest.git.deleteRef({
        ...context.repo,
        ref: `heads/${pr.head.ref}`,
      });
  }
}

module.exports = {
  SYNC_BRANCH,
  publishedRelease,
  syncPublished,
  autoMergePublishedSync,
  cleanupMerged,
};
