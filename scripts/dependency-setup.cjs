const { requireAdmin, optional } = require('./dependency-state.cjs');
const { APPROVAL_LABEL, GATE } = require('./dependency-policy.cjs');

// Explicit administrator action after the controller is released on main.
// Preserve every existing rule, condition and bypass setting.
async function setup(options) {
  await requireAdmin(options);
  const { github, context } = options;
  if (context.ref !== 'refs/heads/main')
    throw Error('Activate dependency governance on main only.');
  await github.request(
    'PUT /repos/{owner}/{repo}/vulnerability-alerts',
    context.repo,
  );
  await github.request(
    'PUT /repos/{owner}/{repo}/automated-security-fixes',
    context.repo,
  );
  const { data: environment } = await github.rest.repos.getEnvironment({
    ...context.repo,
    environment_name: 'staging',
  });
  if (
    environment.deployment_branch_policy?.protected_branches !== false ||
    environment.deployment_branch_policy?.custom_branch_policies !== true
  )
    throw Error(
      'Staging must use selected deployment branches; review environment policy manually.',
    );
  const policies = await github.paginate(
    github.rest.repos.listDeploymentBranchPolicies,
    {
      ...context.repo,
      environment_name: 'staging',
      per_page: 100,
    },
  );
  if (
    !policies.some(
      (p) => p.name === 'cloudflare-migration' && p.type === 'branch',
    )
  )
    throw Error('Existing development staging branch policy is missing.');
  if (!policies.some((p) => p.name === 'main' && p.type === 'branch'))
    await github.rest.repos.createDeploymentBranchPolicy({
      ...context.repo,
      environment_name: 'staging',
      name: 'main',
      type: 'branch',
    });
  const updatedPolicies = await github.paginate(
    github.rest.repos.listDeploymentBranchPolicies,
    {
      ...context.repo,
      environment_name: 'staging',
      per_page: 100,
    },
  );
  if (
    !['main', 'cloudflare-migration'].every((name) =>
      updatedPolicies.some((p) => p.name === name && p.type === 'branch'),
    )
  )
    throw Error('Staging controller branch policy read-back failed.');
  const label = await optional(() =>
    github.rest.issues.getLabel({
      ...context.repo,
      name: APPROVAL_LABEL,
    }),
  );
  if (!label)
    await github.rest.issues.createLabel({
      ...context.repo,
      name: APPROVAL_LABEL,
      color: '0E8A16',
      description:
        'Administrator verified the exact staging update; audit event required',
    });
  const rulesets = await github.paginate(github.rest.repos.getRepoRulesets, {
    ...context.repo,
    per_page: 100,
  });
  // Select the existing main-only ruleset; never broaden it to other branches.
  const candidates = [];
  for (const item of rulesets) {
    const { data } = await github.rest.repos.getRepoRuleset({
      ...context.repo,
      ruleset_id: item.id,
    });
    if (
      data.target === 'branch' &&
      data.enforcement === 'active' &&
      data.source_type === 'Repository' &&
      data.conditions?.ref_name?.exclude?.length === 0 &&
      data.conditions.ref_name.include?.length === 1 &&
      data.conditions.ref_name.include[0] === 'refs/heads/main'
    )
      candidates.push(data);
  }
  if (candidates.length !== 1)
    throw Error('Select one active main-only repository ruleset manually.');
  const rule = candidates[0];
  const checks = rule.rules.find((r) => r.type === 'required_status_checks');
  if (!checks)
    throw Error(
      'Existing required checks rule is missing; refusing to replace repository policy.',
    );
  for (const context of ['Contribution checks', GATE]) {
    if (
      !checks.parameters.required_status_checks.some(
        (c) => c.context === context,
      )
    )
      checks.parameters.required_status_checks.push({
        context,
        ...(context === 'Contribution checks' ? { integration_id: 15368 } : {}),
      });
  }
  await github.rest.repos.updateRepoRuleset({
    ...context.repo,
    ruleset_id: rule.id,
    name: rule.name,
    target: rule.target,
    enforcement: rule.enforcement,
    conditions: rule.conditions,
    bypass_actors: rule.bypass_actors,
    rules: rule.rules,
  });
  const { data: actual } = await github.rest.repos.getRepoRuleset({
    ...context.repo,
    ruleset_id: rule.id,
  });
  const names =
    actual.rules
      .find((r) => r.type === 'required_status_checks')
      ?.parameters.required_status_checks.map((c) => c.context) || [];
  if (
    !['PR checks', 'Formatting', 'Contribution checks', GATE].every((name) =>
      names.includes(name),
    )
  )
    throw Error('Required checks read-back failed.');
  // 204 means enabled. Any authorization or availability error fails this action.
  await github.request(
    'GET /repos/{owner}/{repo}/vulnerability-alerts',
    context.repo,
  );
  const { data: fixes } = await github.request(
    'GET /repos/{owner}/{repo}/automated-security-fixes',
    context.repo,
  );
  if (!fixes.enabled)
    throw Error('Dependabot security updates are not enabled.');
  return { rulesetId: rule.id, checks: names, securityUpdates: true };
}

module.exports = { setup };
