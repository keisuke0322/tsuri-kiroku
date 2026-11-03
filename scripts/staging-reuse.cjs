const { createHash } = require('node:crypto');
const {
  readState,
  writeState,
  currentMain,
} = require('./dependency-state.cjs');
const {
  getDevelopmentBranch,
  isDevelopmentBranch,
} = require('./development-branch.cjs');

function runtimeConfigHash(config) {
  const vars = { ...config.vars };
  delete vars.APP_BUILD_INFO;
  return createHash('sha256')
    .update(JSON.stringify({ ...config, vars }))
    .digest('hex');
}

async function tree({ github, context }, sha) {
  const { data } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: sha,
  });
  if (!data.tree?.sha) throw Error('Missing source tree.');
  return data;
}

async function successfulRun({ github, context }, record, fullE2E) {
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  const { data: run } = await github.rest.actions.getWorkflowRun({
    ...context.repo,
    run_id: record.runId,
  });
  if (
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    run.path !== '.github/workflows/cloudflare.yml' ||
    run.event !== 'push' ||
    !isDevelopmentBranch(run.head_branch) ||
    run.head_sha !== record.sha ||
    String(run.run_attempt) !== String(record.runAttempt) ||
    run.repository?.full_name !== repository ||
    run.head_repository?.full_name !== repository
  )
    throw Error('Staging evidence run identity or result changed.');
  const jobs = await github.paginate(
    github.rest.actions.listJobsForWorkflowRun,
    {
      ...context.repo,
      run_id: run.id,
      filter: 'latest',
      per_page: 100,
    },
  );
  const deploy = jobs.find((j) => j.name === 'Deploy');
  const step = (name) =>
    deploy?.steps?.find((s) => s.name === name)?.conclusion;
  if (
    deploy?.conclusion !== 'success' ||
    step('Verify running version and record deployment result') !== 'success' ||
    (fullE2E && step('Run authenticated staging E2E') !== 'success') ||
    (!fullE2E && step('Run authenticated staging E2E') !== 'skipped')
  )
    throw Error('Successful staging verification and E2E evidence required.');
  return run;
}

async function verifyReuse(options, record) {
  const source = record.reusedFrom;
  if (
    record.environment !== 'staging' ||
    record.result !== 'success' ||
    !record.verifiedAt ||
    !source ||
    source.reusedFrom ||
    source.environment !== 'staging' ||
    source.result !== 'success' ||
    !source.verifiedAt ||
    !source.cloudflare?.deploymentId ||
    !source.cloudflare?.versionId ||
    !record.sourceTree ||
    !record.runtimeConfigSha256 ||
    record.runtimeConfigSha256 !== source.runtimeConfigSha256 ||
    record.lockfileSha256 !== source.lockfileSha256 ||
    JSON.stringify(record.toolchain) !== JSON.stringify(source.toolchain) ||
    record.cloudflare?.versionId !== source.cloudflare.versionId ||
    record.cloudflare?.deploymentId !== source.cloudflare.deploymentId
  )
    throw Error('Invalid reused staging provenance.');
  const [target, original] = await Promise.all([
    tree(options, record.sha),
    tree(options, source.sha),
  ]);
  if (
    target.tree.sha !== record.sourceTree ||
    original.tree.sha !== record.sourceTree
  )
    throw Error('Reused source tree differs.');
  await successfulRun(options, source, true);
  await successfulRun(options, record, false);
  return source;
}

async function selectReuse(options, { selection, record, log = () => {} }) {
  if (selection.kind !== 'development' || options.context.eventName !== 'push')
    return null;
  try {
    const state = await readState(options);
    if (state.lease) return null;
    const previous = state.lastDevelopmentValidation;
    if (!previous || previous.result !== 'success') return null;
    const { name, data } = await getDevelopmentBranch(options);
    if (
      options.context.ref !== `refs/heads/${name}` ||
      data.object.sha !== selection.sha
    )
      return null;
    const commit = await tree(options, selection.sha);
    if (
      commit.parents?.length !== 2 ||
      commit.parents[0].sha !== previous.sha ||
      commit.tree.sha !== previous.sourceTree
    )
      return null;
    const repository = `${options.context.repo.owner}/${options.context.repo.repo}`;
    const prs = await options.github.paginate(options.github.rest.pulls.list, {
      ...options.context.repo,
      state: 'closed',
      base: name,
      head: `${options.context.repo.owner}:main`,
      per_page: 100,
    });
    const sync = prs.filter(
      (p) =>
        p.merged_at &&
        p.merge_commit_sha === selection.sha &&
        p.head.ref === 'main' &&
        p.base.ref === name &&
        p.head.repo?.full_name === repository &&
        p.base.repo?.full_name === repository,
    );
    if (sync.length !== 1) return null;
    const { record: published } =
      await require('./dependency-sync.cjs').publishedRelease(options);
    if (
      published.sha !== commit.parents[1].sha ||
      (await currentMain(options)) !== published.sha
    )
      return null;
    const { data: releasePR } = await options.github.rest.pulls.get({
      ...options.context.repo,
      pull_number: published.pr.number,
    });
    // Dependency updates always take the usual restoration / staging route.
    if (
      !releasePR.merged_at ||
      releasePR.merge_commit_sha !== published.sha ||
      releasePR.base.ref !== 'main' ||
      !isDevelopmentBranch(releasePR.head.ref) ||
      releasePR.head.repo?.full_name !== repository ||
      releasePR.base.repo?.full_name !== repository ||
      releasePR.head.sha !== published.pr.headSha
    )
      return null;
    const source = previous.reusedFrom || previous;
    if (previous.reusedFrom) await verifyReuse(options, previous);
    else await successfulRun(options, previous, true);
    const original = await tree(options, source.sha);
    if (
      source.environment !== 'staging' ||
      !source.verifiedAt ||
      !source.cloudflare?.deploymentId ||
      !source.cloudflare?.versionId ||
      !source.lockfileSha256 ||
      !source.toolchain?.node ||
      !source.toolchain?.packageManager ||
      original.tree.sha !== commit.tree.sha ||
      !source.runtimeConfigSha256 ||
      source.runtimeConfigSha256 !== record.runtimeConfigSha256 ||
      source.lockfileSha256 !== record.lockfileSha256 ||
      JSON.stringify(source.toolchain) !== JSON.stringify(record.toolchain)
    )
      return null;
    return { source, sourceTree: commit.tree.sha };
  } catch {
    log(
      '既存の検証記録を照合できないため、通常のstagingデプロイ・E2Eを実行します。',
    );
    return null;
  }
}

async function rememberStaging(options, record) {
  if (!record.runtimeConfigSha256)
    throw Error('Missing staging configuration identity.');
  const state = await readState(options);
  if (state.lease) throw Error('Staging is owned by a dependency update.');
  const { name, data } = await getDevelopmentBranch(options);
  if (
    options.context.ref !== `refs/heads/${name}` ||
    data.object.sha !== record.sha
  )
    throw Error('Development changed before recording validation.');
  const commit = await tree(options, record.sha);
  const proof = { ...record, sourceTree: commit.tree.sha };
  state.lastDevelopmentValidation = proof;
  if (record.reusedFrom) {
    const receipts = { ...state.stagingReuses };
    delete receipts[record.sha];
    receipts[record.sha] = proof;
    state.stagingReuses = Object.fromEntries(
      Object.entries(receipts).slice(-50),
    );
  } else if (state.stagingReuses?.[record.sha]) {
    delete state.stagingReuses[record.sha];
  }
  await writeState(options, state);
}

async function reusedStaging(options, sha, run) {
  const state = await readState(options);
  const proof = state.stagingReuses?.[sha];
  if (!proof) {
    if (run?.reused) throw Error('Missing reused staging evidence.');
    return null;
  }
  if (proof.sha !== sha)
    throw Error('Reused staging source does not match requested SHA.');
  if (
    run &&
    (String(run.id) !== String(proof.runId) ||
      (run.run_attempt && String(run.run_attempt) !== String(proof.runAttempt)))
  )
    throw Error('Reused staging run does not match validation.');
  const source = await verifyReuse(options, proof);
  return {
    sha: source.sha,
    validatedSha: sha,
    sourceTree: proof.sourceTree,
    reused: true,
    runId: proof.runId,
    sourceRunId: source.runId,
    cloudflare: source.cloudflare,
    actionsUrl: source.actionsUrl,
  };
}

module.exports = {
  runtimeConfigHash,
  selectReuse,
  rememberStaging,
  reusedStaging,
  verifyReuse,
};
