// Both PR validation and production promotion verify the source commit, not the merge SHA.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function validateSource(pr, repository, dependencyUpdate = false) {
  if (
    pr.base?.ref !== 'main' ||
    (!dependencyUpdate && pr.head?.ref !== 'cloudflare-migration') ||
    pr.head?.repo?.full_name !== repository ||
    pr.base?.repo?.full_name !== repository ||
    !pr.head?.sha
  ) {
    throw new Error(
      'Only cloudflare-migration -> main PRs in this repository may release.',
    );
  }
  return pr.head.sha;
}

function isDocumentationOnly(files) {
  return (
    files.length > 0 &&
    files.every((file) =>
      /^(?:README(?:\.[^/]*)?|[^/]+\.md|docs\/.*|\.github\/ISSUE_TEMPLATE\/.*|\.github\/PULL_REQUEST_TEMPLATE(?:\/.*|\.md))$/i.test(
        file.filename,
      ),
    )
  );
}

async function requireStaging({
  github,
  context,
  sha,
  attempts = 1,
  sleep = pause,
  log = () => {},
}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const deployments = await github.paginate(
      github.rest.repos.listDeployments,
      {
        ...context.repo,
        sha,
        environment: 'staging',
        per_page: 100,
      },
    );
    const latest = deployments
      .filter((d) => d.sha === sha && d.environment === 'staging')
      .sort((a, b) => b.id - a.id)[0];
    if (latest) {
      const statuses = await github.paginate(
        github.rest.repos.listDeploymentStatuses,
        {
          ...context.repo,
          deployment_id: latest.id,
          per_page: 100,
        },
      );
      const state = statuses[0]?.state;
      if (
        state === 'success' ||
        (state === 'inactive' && statuses.some((s) => s.state === 'success'))
      ) {
        log(`Verified staging success for ${sha}`);
        return {
          sha,
          deploymentId: latest.id,
          actionsUrl:
            statuses.find((s) => s.state === 'success')?.log_url || null,
        };
      }
      if (state === 'failure' || state === 'error')
        throw new Error(`Staging failed for ${sha}. Re-run staging first.`);
    }
    // Documentation-only commits may reuse a successful staging deployment
    // of an ancestor. Application, workflow and test changes never qualify.
    if (!latest) {
      const candidates = await github.paginate(
        github.rest.repos.listDeployments,
        { ...context.repo, environment: 'staging', per_page: 100 },
      );
      for (const candidate of candidates.sort((a, b) => b.id - a.id)) {
        if (!candidate.sha || candidate.sha === sha) continue;
        const comparison = await github.rest.repos.compareCommits({
          ...context.repo,
          base: candidate.sha,
          head: sha,
          per_page: 100,
        });
        const { status, files, total_commits, commits } = comparison.data;
        if (
          status !== 'ahead' ||
          !files ||
          files.length >= 300 ||
          total_commits !== commits.length ||
          !isDocumentationOnly(files)
        )
          continue;
        const statuses = await github.paginate(
          github.rest.repos.listDeploymentStatuses,
          { ...context.repo, deployment_id: candidate.id, per_page: 100 },
        );
        if (
          statuses[0]?.state === 'success' ||
          (statuses[0]?.state === 'inactive' &&
            statuses.some((s) => s.state === 'success'))
        ) {
          log(
            `Documentation-only changes: reused successful staging ${candidate.sha} for ${sha}`,
          );
          return {
            sha: candidate.sha,
            deploymentId: candidate.id,
            actionsUrl:
              statuses.find((s) => s.state === 'success')?.log_url || null,
          };
        }
      }
    }
    if (attempt + 1 < attempts) {
      log(`Waiting for staging ${sha} (${attempt + 1}/${attempts})`);
      await sleep(15000);
    }
  }
  throw new Error(
    `No successful staging deployment for ${sha}. Wait for staging, then re-run this check.`,
  );
}

async function checkPullRequest(options) {
  const { context } = options;
  const pr = context.payload.pull_request;
  if (pr.head.ref !== 'cloudflare-migration') {
    const { requireUpdateEvidence } = require('./dependency-policy.cjs');
    const attempts =
      options.attempts ?? (context.payload.action === 'labeled' ? 40 : 1);
    for (let i = 0; i < attempts; i++) {
      try {
        return await requireUpdateEvidence(options, pr);
      } catch (error) {
        if (
          i + 1 === attempts ||
          !/Current staging validation|Staging workflow did not/.test(
            error.message,
          )
        )
          throw error;
        await (options.sleep || pause)(15000);
      }
    }
  }
  const sha = validateSource(pr, `${context.repo.owner}/${context.repo.repo}`);
  if (!options.skipFeatureGate)
    await require('./dependency-policy.cjs').requireFeatureReady(options, pr);
  await requireStaging({ attempts: 40, ...options, sha });
}

async function checkProduction(options) {
  const { github, context } = options;
  if (context.ref !== 'refs/heads/main')
    throw new Error('Production must deploy main.');
  const prs = await github.paginate(
    github.rest.repos.listPullRequestsAssociatedWithCommit,
    {
      ...context.repo,
      commit_sha: context.sha,
      per_page: 100,
    },
  );
  const merged = prs.find(
    (pr) =>
      pr.merged_at &&
      pr.merge_commit_sha === context.sha &&
      pr.base.ref === 'main',
  );
  if (!merged)
    throw new Error(
      'Production requires a merged PR at this main commit; direct pushes are not released.',
    );
  let staging;
  if (merged.head.ref !== 'cloudflare-migration') {
    const { data: commit } = await github.rest.repos.getCommit({
      ...context.repo,
      ref: context.sha,
    });
    if (
      commit.parents?.length !== 2 ||
      commit.parents[1].sha !== merged.head.sha
    )
      throw Error(
        'Dependency updates require a merge commit preserving the reviewed source.',
      );
    const baseSha = commit.parents[0].sha;
    staging = await require('./dependency-policy.cjs').requireUpdateEvidence(
      { ...options, baseSha },
      merged,
      { production: true },
    );
  } else {
    const sha = validateSource(
      merged,
      `${context.repo.owner}/${context.repo.repo}`,
    );
    // Recompute unresolved/expired updates immediately before production.
    await require('./dependency-policy.cjs').requireFeatureReady(
      options,
      merged,
      { production: true },
    );
    staging = await requireStaging({ ...options, sha });
  }
  return { pr: merged, staging };
}

module.exports = {
  validateSource,
  requireStaging,
  checkPullRequest,
  checkProduction,
};
