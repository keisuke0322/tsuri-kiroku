const { readFileSync } = require('node:fs');
const {
  readState,
  writeState,
  requireAdmin,
  currentMain,
  optional,
} = require('./dependency-state.cjs');
const {
  APPROVAL_LABEL,
  GATE,
  DAY,
  isUpdate,
  inspectUpdate,
  requireCI,
  latestContributionRun,
  matchesLease,
  requireUpdateEvidence,
  requireFeatureReady,
} = require('./dependency-policy.cjs');
const { parseRelease, compareVersions } = require('./release-policy.cjs');

async function getPr(options, number) {
  if (!/^[1-9]\d*$/.test(String(number)))
    throw Error('A PR number is required.');
  return (
    await options.github.rest.pulls.get({
      ...options.context.repo,
      pull_number: Number(number),
    })
  ).data;
}

async function validationBase(options, pr) {
  const main = await currentMain(options);
  if (!pr.merged_at) return { main, baseSha: main, production: false };
  if (pr.merge_commit_sha !== main)
    throw Error('Merged update recovery requires the current main release PR.');
  const { data: commit } = await options.github.rest.repos.getCommit({
    ...options.context.repo,
    ref: main,
  });
  if (commit.parents?.length !== 2 || commit.parents[1].sha !== pr.head.sha)
    throw Error('Merged update recovery requires the original merge commit.');
  return { main, baseSha: commit.parents[0].sha, production: true };
}

async function removeApproval({ github, context }, pr) {
  if (pr.labels?.some((l) => l.name === APPROVAL_LABEL))
    await github.rest.issues.removeLabel({
      ...context.repo,
      issue_number: pr.number,
      name: APPROVAL_LABEL,
    });
}

async function prepareUpdate(options, number, { expectedHead } = {}) {
  await requireAdmin(options);
  const { github, context } = options;
  const state = await readState(options);
  const pr = await getPr(options, number);
  if (expectedHead && pr.head.sha !== expectedHead)
    throw Error('PR changed before preparation; start validation again.');
  if (pr.state !== 'open') throw Error('Update PR must be open.');
  if (state.lease && state.lease.pr !== pr.number)
    throw Error(
      'Another PR owns staging. Finish or explicitly abort it first.',
    );
  // This explicit, administrator-only action authorizes a manual update PR.
  state.manuals[pr.number] = {
    actor: context.actor,
    at: new Date().toISOString(),
  };
  const { package: pkg, baseSha } = await inspectUpdate(options, pr, state);
  let head = pr.head.sha;
  const latest = await optional(() =>
    github.rest.repos.getLatestRelease(context.repo),
  );
  if (!latest || !/^v\d+\.\d+\.\d+$/.test(latest.tag_name))
    throw Error(
      'A formal production Release is required before preparing an update.',
    );
  const [major, minor, patch] = latest.tag_name.slice(1).split('.');
  const next = `${major}.${minor}.${BigInt(patch) + 1n}`;
  if (compareVersions(`v${pkg.version}`, latest.tag_name) <= 0) {
    const file = (
      await github.rest.repos.getContent({
        ...context.repo,
        path: 'package.json',
        ref: pr.head.sha,
      })
    ).data;
    const content = Buffer.from(file.content, 'base64')
      .toString('utf8')
      .replace(/("version"\s*:\s*")[^"]+"/, `$1${next}"`);
    const { data } = await github.rest.repos.createOrUpdateFileContents({
      ...context.repo,
      branch: pr.head.ref,
      path: 'package.json',
      sha: file.sha,
      message: `chore: prepare app release v${next}`,
      content: Buffer.from(content).toString('base64'),
    });
    head = data.commit.sha;
    pkg.version = next;
  }
  let body = (pr.body || '').replace(/^Release-Version:.*\n?/gm, '').trim();
  body = `Release-Version: v${pkg.version}\n\n${body}`;
  if (!/^### DB変更・復旧\s*$/m.test(body))
    body +=
      '\n\n### DB変更・復旧\n\nDB変更なし。既存スキーマ・旧Workerと互換性あり。Workerを戻してもDBは戻らない。';
  parseRelease(body);
  await github.rest.pulls.update({
    ...context.repo,
    pull_number: pr.number,
    body,
  });
  if (state.lease) {
    state.lease.phase = 'reserved';
    delete state.lease.approval;
    delete state.lease.validation;
  }
  await writeState(options, state);
  await removeApproval(options, pr);
  return { pr: pr.number, head, base: baseSha };
}

async function startUpdate(
  options,
  number,
  {
    attempts = 40,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  const { github, context } = options;
  await requireAdmin(options);
  if (
    context.eventName !== 'workflow_dispatch' ||
    context.ref !== 'refs/heads/main' ||
    context.sha !== (await currentMain(options))
  )
    throw Error('Start update validation from the latest main.');
  const original = await getPr(options, number);
  const originalHead = original.head.sha;
  const target = await prepareUpdate(options, number, {
    expectedHead: originalHead,
  });
  options.log?.(
    `Prepared PR #${target.pr} at ${target.head}; waiting for its CI.`,
  );
  if (target.head !== originalHead) {
    const { data: commit } = await github.rest.git.getCommit({
      ...context.repo,
      commit_sha: target.head,
    });
    if (commit.parents?.length !== 1 || commit.parents[0].sha !== originalHead)
      throw Error('PR changed during preparation; start validation again.');
  }
  for (let attempt = 0; attempt < attempts; attempt++) {
    const pr = await getPr(options, target.pr);
    if (
      pr.state !== 'open' ||
      pr.head.sha !== target.head ||
      (await currentMain(options)) !== target.base ||
      target.base !== context.sha
    )
      throw Error('PR/main changed; start validation again.');
    const run = await latestContributionRun(options, pr);
    if (run?.status === 'completed') {
      if (run.conclusion !== 'success')
        throw Error(
          'Contribution checks failed; fix the update before restarting.',
        );
      return target;
    }
    options.log?.(
      `Waiting for Contribution checks (${attempt + 1}/${attempts}): ${run?.id || 'not started'}`,
    );
    if (attempt + 1 < attempts) await sleep(15000);
  }
  throw Error(
    'Timed out waiting for Contribution checks; restart validation after CI completes.',
  );
}

async function selectDeployment(
  options,
  { action = 'development', number, expectedHead } = {},
) {
  const { github, context } = options;
  if (
    !['refs/heads/main', 'refs/heads/cloudflare-migration'].includes(
      context.ref,
    )
  )
    throw Error('Run the controller from main or cloudflare-migration.');
  const state = await readState(options);
  if (action === 'validate-update') {
    if (context.ref !== 'refs/heads/main')
      throw Error('Update validation controller must run on main.');
    await requireAdmin(options);
    const pr = await getPr(options, number);
    if (expectedHead && pr.head.sha !== expectedHead)
      throw Error('Prepared PR head changed; start validation again.');
    if (pr.state !== 'open' && !pr.merged_at)
      throw Error('Open or merged current-main update PR required.');
    const baseline = await validationBase(options, pr);
    const { baseSha } = await inspectUpdate(
      { ...options, baseSha: baseline.baseSha },
      pr,
      state,
      { production: baseline.production },
    );
    if (
      context.sha !== baseline.main ||
      (!baseline.production && baseSha !== baseline.main)
    )
      throw Error('Controller is stale; start again from latest main.');
    if (state.lease && state.lease.pr !== pr.number)
      throw Error(`Staging is reserved for PR #${state.lease.pr}.`);
    await requireCI(options, pr);
    state.lease = {
      pr: pr.number,
      head: pr.head.sha,
      base: baseSha,
      controller: context.sha,
      phase: 'validating',
      actor: context.actor,
      runId: String(context.runId),
      at: new Date().toISOString(),
    };
    await writeState(options, state);
    await removeApproval(options, pr);
    return { sha: pr.head.sha, kind: 'update', pr: pr.number };
  }
  if (action === 'abort-update' || action === 'restore-development') {
    if (context.eventName !== 'workflow_dispatch')
      throw Error('Explicit controller invocation required.');
    if (action === 'abort-update') {
      await requireAdmin(options);
    } else if (state.lease && state.lease.phase !== 'restoring') {
      // Automatic restore is authorized only by a matching, formally published release.
      const { record } =
        await require('./dependency-sync.cjs').publishedRelease(options);
      if (
        record.pr.number !== state.lease.pr ||
        record.pr.headSha !== state.lease.head
      )
        throw Error(
          'The staging owner has not been successfully published. Use abort-update to cancel.',
        );
    }
    if (state.lease) {
      state.lease.phase = 'restoring';
      delete state.lease.approval;
      await writeState(options, state);
      await removeApproval(options, await getPr(options, state.lease.pr));
    }
    const sha = (
      await github.rest.git.getRef({
        ...context.repo,
        ref: 'heads/cloudflare-migration',
      })
    ).data.object.sha;
    return { sha, kind: 'restore' };
  }
  if (action !== 'development') throw Error('Unsupported deployment action.');
  if (context.ref === 'refs/heads/main')
    return { sha: context.sha, kind: 'production' };
  if (state.lease)
    throw Error(
      `Staging held by PR #${state.lease.pr} (${state.lease.phase}); development deployment paused.`,
    );
  const latest = (
    await github.rest.git.getRef({
      ...context.repo,
      ref: 'heads/cloudflare-migration',
    })
  ).data.object.sha;
  if (latest !== context.sha)
    throw Error('Superseded development commit; deploy latest branch instead.');
  return { sha: context.sha, kind: 'development' };
}

async function finishDeployment(
  options,
  selection,
  record = JSON.parse(readFileSync('.release-runtime/record.json', 'utf8')),
) {
  const state = await readState(options);
  if (
    record.result !== 'success' ||
    record.sha !== selection.sha ||
    record.runId !== String(options.context.runId) ||
    !record.cloudflare?.deploymentId ||
    !record.cloudflare?.versionId ||
    !record.verifiedAt
  )
    throw Error('Successful deployment, E2E and running identity required.');
  if (selection.kind === 'update') {
    const lease = state.lease;
    if (
      lease?.runId !== String(options.context.runId) ||
      lease.head !== selection.sha
    )
      throw Error('Staging ownership changed.');
    const pr = await getPr(options, lease.pr);
    const baseline = await validationBase(options, pr);
    const { baseSha } = await inspectUpdate(
      { ...options, baseSha: baseline.baseSha },
      pr,
      state,
      { production: baseline.production },
    );
    if (!matchesLease(lease, pr, baseSha))
      throw Error('PR/main changed during validation. Revalidate.');
    lease.phase = 'verified';
    lease.validation = {
      runId: String(options.context.runId),
      deploymentId: record.cloudflare.deploymentId,
      url: record.actionsUrl,
      cloudflareVersionId: record.cloudflare.versionId,
      at: record.verifiedAt,
    };
    await writeState(options, state);
  } else if (selection.kind === 'restore') {
    if (state.lease && state.lease.phase !== 'restoring')
      throw Error('Restore no longer owns staging.');
    state.lease = null;
    await writeState(options, state);
  }
}

async function reconcileApproval(options) {
  const { github, context } = options;
  const state = await readState(options);
  const lease = state.lease;
  if (!lease || lease.phase === 'restoring') return;
  const pr = await getPr(options, lease.pr);
  // A merged PR keeps its original base evidence for production/recovery.
  const baseline = await validationBase(options, pr);
  if (
    !matchesLease(lease, pr, baseline.baseSha) ||
    (pr.state !== 'open' && !pr.merged_at)
  ) {
    lease.phase = 'reserved';
    delete lease.approval;
    delete lease.validation;
    await writeState(options, state);
    await removeApproval(options, pr);
    return;
  }
  const { latestApprovalEvent } = require('./dependency-policy.cjs');
  const event = await latestApprovalEvent(options, pr);
  if (!pr.labels?.some((l) => l.name === APPROVAL_LABEL)) {
    if (lease.approval) {
      delete lease.approval;
      await writeState(options, state);
    }
    return;
  }
  if (lease.approval?.eventId === event?.id) return;
  // Reconcile from GitHub's audit events, not a label or a user-authored comment.
  // This also handles GitHub concurrency replacing a pending label-event run.
  let allowed = false;
  if (
    lease.phase === 'verified' &&
    event?.event === 'labeled' &&
    Date.parse(event.created_at) >= Date.parse(lease.validation.at)
  ) {
    try {
      await requireAdmin(options, event.actor.login);
      allowed = true;
    } catch (error) {
      if (error.message !== 'Repository administrator required.') throw error;
    }
    const { data: run } = await github.rest.actions.getWorkflowRun({
      ...context.repo,
      run_id: lease.validation.runId,
    });
    allowed = allowed && run.conclusion === 'success';
  }
  if (!allowed) {
    delete lease.approval;
    await writeState(options, state);
    await removeApproval(options, pr);
    return;
  }
  await require('./dependency-policy.cjs').requireRunningUpdate(options, lease);
  lease.approval = {
    actor: event.actor.login,
    at: event.created_at,
    eventId: event.id,
    runId: lease.validation.runId,
    head: lease.head,
    base: lease.base,
  };
  await writeState(options, state);
  await github.rest.issues.createComment({
    ...context.repo,
    issue_number: pr.number,
    body: `管理者 @${event.actor.login} が動作確認済み。\n\nhead: ${lease.head}\nmain: ${lease.base}\n確認日時: ${event.created_at}\n検証: ${lease.validation.url}`,
  });
}

async function deferUpdate(options, number, reason, remove = false) {
  await requireAdmin(options);
  const { github, context } = options;
  const state = await readState(options);
  const pr = await getPr(options, number);
  if (pr.state !== 'open' || !isUpdate(pr, state))
    throw Error('Open dependency PR required.');
  const old = state.deferrals[pr.number];
  if (remove) delete state.deferrals[pr.number];
  else {
    if (
      !reason?.trim() ||
      reason.length > 2000 ||
      reason.trim() === old?.reason
    )
      throw Error('A new, nonempty deferral reason is required.');
    const now = Date.now();
    state.deferrals[pr.number] = {
      reason: reason.trim(),
      actor: context.actor,
      head: pr.head.sha,
      at: new Date(now).toISOString(),
      expires: new Date(now + 30 * DAY).toISOString(),
    };
  }
  await writeState(options, state);
  await github.rest.issues.createComment({
    ...context.repo,
    issue_number: pr.number,
    body: remove
      ? `管理者 @${context.actor} が依存更新の保留を解除しました。`
      : `依存更新の保留（採用・マージではありません）\n\n${JSON.stringify(state.deferrals[pr.number], null, 2)}`,
  });
}

async function refreshGates(options) {
  const { github, context } = options;
  const prs = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    state: 'open',
    base: 'main',
    per_page: 100,
  });
  for (const pr of prs) {
    await github.rest.repos.createCommitStatus({
      ...context.repo,
      sha: pr.head.sha,
      context: GATE,
      state: 'pending',
      description: 'Rechecking current dependency release policy',
    });
  }
  let reconciliationError;
  try {
    await reconcileApproval(options);
  } catch (error) {
    reconciliationError = error;
  }
  for (const pr of prs) {
    let error;
    try {
      if (reconciliationError) throw reconciliationError;
      if (pr.head.ref === 'cloudflare-migration')
        await requireFeatureReady(options, pr);
      else await requireUpdateEvidence(options, pr);
    } catch (e) {
      error = e;
    }
    await github.rest.repos.createCommitStatus({
      ...context.repo,
      sha: pr.head.sha,
      context: GATE,
      state: error ? 'failure' : 'success',
      description: error
        ? error.message.slice(0, 140)
        : 'Current dependency release policy satisfied',
      target_url: `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
    });
    if (error) console.log(`#${pr.number}: ${error.message}`);
  }
}

module.exports = {
  getPr,
  prepareUpdate,
  startUpdate,
  selectDeployment,
  finishDeployment,
  reconcileApproval,
  deferUpdate,
  refreshGates,
  removeApproval,
};
