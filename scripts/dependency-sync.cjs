const { optional } = require('./dependency-state.cjs');
const SYNC_BRANCH = 'automation/published-main';

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
  const { data: development } = await github.rest.repos.compareCommits({
    ...context.repo,
    base: record.sha,
    head: 'cloudflare-migration',
    per_page: 100,
  });
  if (['ahead', 'identical'].includes(development.status)) return;
  const old = await optional(() =>
    github.rest.git.getRef({ ...context.repo, ref: `heads/${SYNC_BRANCH}` }),
  );
  if (old && old.object.sha !== record.sha) {
    const { data } = await github.rest.repos.compareCommits({
      ...context.repo,
      base: old.object.sha,
      head: record.sha,
      per_page: 100,
    });
    if (data.status === 'ahead') {
      await github.rest.git.updateRef({
        ...context.repo,
        ref: `heads/${SYNC_BRANCH}`,
        sha: record.sha,
        force: false,
      });
    } else if (data.status === 'diverged') {
      // Preserve administrator conflict resolutions and development changes on
      // the sync branch. Merge only the exact published commit, never live main.
      await github.rest.repos.merge({
        ...context.repo,
        base: SYNC_BRANCH,
        head: record.sha,
        commit_message: `chore: sync published ${release.tag_name}`,
      });
    } else if (!['behind', 'identical'].includes(data.status)) {
      throw Error('Could not establish published sync history.');
    }
  } else if (!old) {
    await github.rest.git.createRef({
      ...context.repo,
      ref: `refs/heads/${SYNC_BRANCH}`,
      sha: record.sha,
    });
  }
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
    '開発中の変更を保持してください。競合は手動解消し、最新の開発コードとのContribution checks成功と差分を確認して手動マージしてください。自動マージしません。';
  const values = {
    ...context.repo,
    title: 'chore: sync published main into development',
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
  cleanupMerged,
};
