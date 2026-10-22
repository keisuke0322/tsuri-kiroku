const { isDeepStrictEqual } = require('node:util');
const {
  readJson,
  readState,
  currentMain,
  requireAdmin,
} = require('./dependency-state.cjs');
const APPROVAL_LABEL = '動作確認済み';
const GATE = 'Dependency release gate';
const DAY = 86400000;

function isDependabot(pr) {
  return pr.user?.login === 'dependabot[bot]' && pr.user?.type === 'Bot';
}

function isUpdate(pr, state) {
  return isDependabot(pr) || Boolean(state.manuals[pr.number]);
}

function validatePackageChange(before, after) {
  const strip = (pkg) => {
    const {
      version,
      dependencies,
      devDependencies,
      optionalDependencies,
      overrides,
      ...rest
    } = pkg;
    for (const group of [dependencies, devDependencies, optionalDependencies])
      if (
        group &&
        (typeof group !== 'object' ||
          Array.isArray(group) ||
          Object.values(group).some((v) => typeof v !== 'string'))
      )
        throw Error('Dependency versions must be strings.');
    const overrideShape = (value) => {
      if (typeof value === 'string') return '<version>';
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw Error('Override versions must be strings.');
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          overrideShape(child),
        ]),
      );
    };
    return {
      ...rest,
      ...(overrides ? { overrides: overrideShape(overrides) } : {}),
    };
  };
  if (!isDeepStrictEqual(strip(before), strip(after)))
    throw Error(
      'Update PR must not change scripts, toolchain, override selectors or other package metadata.',
    );
}

function validateWorkspaceChange(before, after) {
  // Emergency age exceptions and existing override versions are the only
  // workspace policy edits admitted for a dependency update.
  const exclude =
    /^minimumReleaseAgeExclude:\n(?:  - ['"]?@?[a-zA-Z0-9._/-]+@\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?['"]?\n)+/m;
  const normalize = (text) =>
    text
      .replace(exclude, '')
      .replace(/^overrides:\n(?:  [^\n]+\n)+/m, (block) =>
        block.replace(
          /^(  [^\n]+: )['"]?\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?['"]?$/gm,
          '$1<version>',
        ),
      );
  if (normalize(before) !== normalize(after))
    throw Error(
      'Only exact age exceptions and existing override versions may change in workspace policy.',
    );
  return Boolean(
    after.match(exclude)?.[0] &&
      before.match(exclude)?.[0] !== after.match(exclude)?.[0],
  );
}

async function textFile(github, repo, path, ref) {
  const { data } = await github.rest.repos.getContent({ ...repo, path, ref });
  if (data.type !== 'file' || data.encoding !== 'base64')
    throw Error('Missing source file.');
  return Buffer.from(data.content, 'base64').toString('utf8');
}

async function inspectUpdate(options, pr, state, { production = false } = {}) {
  const { github, context } = options;
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  if (
    !isUpdate(pr, state) ||
    pr.base?.ref !== 'main' ||
    pr.base?.repo?.full_name !== repository ||
    pr.head?.repo?.full_name !== repository ||
    pr.head.ref === 'main' ||
    pr.head.ref === 'cloudflare-migration' ||
    !pr.head.sha
  )
    throw Error(
      'Only same-repository, main-based dependency update PRs are eligible.',
    );
  const baseSha = production ? options.baseSha : await currentMain(options);
  const { data: comparison } = await github.rest.repos.compareCommits({
    ...context.repo,
    base: baseSha,
    head: pr.head.sha,
    per_page: 100,
  });
  if (
    comparison.status !== 'ahead' ||
    comparison.merge_base_commit?.sha !== baseSha
  )
    throw Error(
      'Update branch must include current main; rebase and revalidate.',
    );
  const files = await github.paginate(github.rest.pulls.listFiles, {
    ...context.repo,
    pull_number: pr.number,
    per_page: 100,
  });
  const allowed = new Set([
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'vendor/LICENSE-SOURCES.md',
  ]);
  if (
    !files.length ||
    !files.some((f) => f.filename === 'pnpm-lock.yaml') ||
    files.some(
      (f) =>
        !allowed.has(f.filename) ||
        f.status === 'removed' ||
        f.previous_filename,
    )
  )
    throw Error(
      'Dependency PR may change only manifest, lockfile, exact age exceptions and license notes.',
    );
  const before = await readJson(github, context.repo, 'package.json', baseSha);
  const after = await readJson(
    github,
    context.repo,
    'package.json',
    pr.head.sha,
  );
  validatePackageChange(before, after);
  if (files.some((f) => f.filename === 'pnpm-workspace.yaml')) {
    const emergencyException = validateWorkspaceChange(
      await textFile(github, context.repo, 'pnpm-workspace.yaml', baseSha),
      await textFile(github, context.repo, 'pnpm-workspace.yaml', pr.head.sha),
    );
    if (emergencyException && !/^Emergency-Reason: \S.+$/m.test(pr.body || ''))
      throw Error('Age exceptions require Emergency-Reason in the PR body.');
  }
  return { baseSha, package: after };
}

async function requireCI({ github, context }, pr) {
  const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
    ...context.repo,
    workflow_id: 'contribution-checks.yml',
    head_sha: pr.head.sha,
    event: 'pull_request',
    per_page: 100,
  });
  const latest = runs
    .filter(
      (r) =>
        r.head_sha === pr.head.sha &&
        r.pull_requests?.some((p) => p.number === pr.number),
    )
    .sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt)[0];
  if (latest?.conclusion !== 'success')
    throw Error(
      `Contribution checks must succeed for PR #${pr.number} at ${pr.head.sha}.`,
    );
  return latest.id;
}

function matchesLease(lease, pr, baseSha) {
  return (
    lease?.pr === pr.number &&
    lease.head === pr.head.sha &&
    lease.base === baseSha
  );
}

async function latestApprovalEvent({ github, context }, pr) {
  const events = await github.paginate(
    github.rest.issues.listEventsForTimeline,
    {
      ...context.repo,
      issue_number: pr.number,
      per_page: 100,
    },
  );
  return events
    .filter(
      (e) =>
        ['labeled', 'unlabeled'].includes(e.event) &&
        e.label?.name === APPROVAL_LABEL,
    )
    .sort((a, b) => b.id - a.id)[0];
}

async function requireRunningUpdate(options, lease) {
  const response = await (options.request || fetch)(
    'https://tsuri-kiroku-staging.keisuke0322.workers.dev/api/version',
    {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw Error('Cannot verify current staging identity.');
  const actual = await response.json();
  if (
    actual.environment !== 'staging' ||
    actual.sha !== lease.head ||
    actual.runId !== lease.validation.runId ||
    actual.cloudflareVersionId !== lease.validation.cloudflareVersionId
  )
    throw Error('Current staging no longer matches the validated update.');
}

async function requireUpdateEvidence(options, pr, { production = false } = {}) {
  const state = await readState(options);
  const { baseSha } = await inspectUpdate(options, pr, state, { production });
  const lease = state.lease;
  if (
    !matchesLease(lease, pr, baseSha) ||
    lease.phase !== 'verified' ||
    !lease.validation?.runId ||
    !lease.approval ||
    lease.approval.runId !== lease.validation.runId ||
    !pr.labels?.some((l) => l.name === APPROVAL_LABEL)
  )
    throw Error(
      'Current staging validation and administrator approval are required.',
    );
  const event = await latestApprovalEvent(options, pr);
  if (
    event?.event !== 'labeled' ||
    event.id !== lease.approval.eventId ||
    event.actor?.login !== lease.approval.actor
  )
    throw Error(
      'Approval label audit event changed; reconfirm current staging.',
    );
  await requireAdmin(options, lease.approval.actor);
  await requireCI(options, pr);
  const { data: run } = await options.github.rest.actions.getWorkflowRun({
    ...options.context.repo,
    run_id: lease.validation.runId,
  });
  if (
    run.conclusion !== 'success' ||
    run.event !== 'workflow_dispatch' ||
    run.path !== '.github/workflows/cloudflare.yml' ||
    run.head_sha !== lease.controller
  )
    throw Error('Staging workflow did not complete successfully.');
  await requireRunningUpdate(options, lease);
  return {
    sha: lease.head,
    deploymentId: lease.validation.deploymentId,
    actionsUrl: lease.validation.url,
  };
}

function validDeferral(hold, pr, now = Date.now()) {
  return Boolean(
    hold &&
      hold.head === pr.head.sha &&
      hold.reason?.trim() &&
      hold.actor &&
      Date.parse(hold.at) <= now &&
      Date.parse(hold.expires) > now &&
      Date.parse(hold.expires) - Date.parse(hold.at) === 30 * DAY,
  );
}

async function requireFeatureReady(options, pr, { production = false } = {}) {
  const { github, context } = options;
  const main = production
    ? (await github.rest.repos.getCommit({ ...context.repo, ref: context.sha }))
        .data.parents?.[0]?.sha
    : await currentMain(options);
  if (!main) throw Error('Missing release base commit.');
  const { data } = await github.rest.repos.compareCommits({
    ...context.repo,
    base: main,
    head: pr.head.sha,
    per_page: 100,
  });
  if (!['ahead', 'identical'].includes(data.status))
    throw Error(
      'Merge current main into cloudflare-migration, then run staging again.',
    );
  const state = await readState(options);
  if (state.lease)
    throw Error(`Staging is reserved for dependency PR #${state.lease.pr}.`);
  const prs = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    state: 'open',
    base: 'main',
    per_page: 100,
  });
  const updates = prs.filter(isDependabot);
  const deferred = updates.filter((p) =>
    validDeferral(state.deferrals[p.number], p),
  );
  // Alert read failure must fail closed, including insufficient token permissions.
  const alerts = deferred.length
    ? await github.paginate('GET /repos/{owner}/{repo}/dependabot/alerts', {
        ...context.repo,
        state: 'open',
        per_page: 100,
      })
    : [];
  const blocked = updates.filter(
    (p) => alerts.length || !validDeferral(state.deferrals[p.number], p),
  );
  if (blocked.length)
    throw Error(
      'Unresolved dependency updates: ' +
        blocked.map((p) => `#${p.number} ${p.html_url}`).join(', '),
    );
}

module.exports = {
  APPROVAL_LABEL,
  GATE,
  DAY,
  isDependabot,
  isUpdate,
  validatePackageChange,
  validateWorkspaceChange,
  inspectUpdate,
  requireCI,
  matchesLease,
  latestApprovalEvent,
  requireRunningUpdate,
  requireUpdateEvidence,
  validDeferral,
  requireFeatureReady,
};
