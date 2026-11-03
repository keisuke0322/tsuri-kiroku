const DEVELOPMENT_BRANCH = 'develop';

function isDevelopmentBranch(name) {
  return name === DEVELOPMENT_BRANCH;
}

async function getDevelopmentBranch({ github, context }) {
  const { data } = await github.rest.git.getRef({
    ...context.repo,
    ref: `heads/${DEVELOPMENT_BRANCH}`,
  });
  if (data.object?.type !== 'commit' || !data.object.sha)
    throw Error('Invalid development branch ref.');
  return { name: DEVELOPMENT_BRANCH, data };
}

module.exports = { isDevelopmentBranch, getDevelopmentBranch };
