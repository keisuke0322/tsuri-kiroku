// Both PR validation and production promotion verify the source commit, not the merge SHA.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function validateSource(pr, repository) {
  if (pr.base?.ref !== 'main' || pr.head?.ref !== 'cloudflare-migration' ||
      pr.head?.repo?.full_name !== repository || pr.base?.repo?.full_name !== repository || !pr.head?.sha) {
    throw new Error('Only cloudflare-migration -> main PRs in this repository may release.');
  }
  return pr.head.sha;
}

async function requireStaging({ github, context, sha, attempts = 1, sleep = pause, log = () => {} }) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const deployments = await github.paginate(github.rest.repos.listDeployments, {
      ...context.repo, sha, environment: 'staging', per_page: 100,
    });
    const latest = deployments.filter((d) => d.sha === sha && d.environment === 'staging')
      .sort((a, b) => b.id - a.id)[0];
    if (latest) {
      const statuses = await github.paginate(github.rest.repos.listDeploymentStatuses, {
        ...context.repo, deployment_id: latest.id, per_page: 100,
      });
      const state = statuses[0]?.state;
      if (state === 'success' || (state === 'inactive' && statuses.some((s) => s.state === 'success'))) {
        log(`Verified staging success for ${sha}`);
        return;
      }
      if (state === 'failure' || state === 'error') throw new Error(`Staging failed for ${sha}. Re-run staging first.`);
    }
    if (attempt + 1 < attempts) {
      log(`Waiting for staging ${sha} (${attempt + 1}/${attempts})`);
      await sleep(15000);
    }
  }
  throw new Error(`No successful staging deployment for ${sha}. Wait for staging, then re-run this check.`);
}

async function checkPullRequest(options) {
  const { context } = options;
  const sha = validateSource(context.payload.pull_request, `${context.repo.owner}/${context.repo.repo}`);
  await requireStaging({ attempts: 40, ...options, sha });
}

async function checkProduction(options) {
  const { github, context } = options;
  if (context.ref !== 'refs/heads/main') throw new Error('Production must deploy main.');
  const prs = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
    ...context.repo, commit_sha: context.sha, per_page: 100,
  });
  const merged = prs.find((pr) => pr.merged_at && pr.merge_commit_sha === context.sha && pr.base.ref === 'main');
  if (!merged) throw new Error('Production requires a merged PR at this main commit; direct pushes are not released.');
  const sha = validateSource(merged, `${context.repo.owner}/${context.repo.repo}`);
  await requireStaging({ ...options, sha });
}
module.exports = { validateSource, requireStaging, checkPullRequest, checkProduction };
