// Keep the existing development route working until the GitHub rename is done.
const DEVELOPMENT_BRANCH = 'develop';
const LEGACY_DEVELOPMENT_BRANCH = 'cloudflare-migration';

function isDevelopmentBranch(name) {
  return [DEVELOPMENT_BRANCH, LEGACY_DEVELOPMENT_BRANCH].includes(name);
}

async function getDevelopmentBranch({ github, context }) {
  for (const name of [DEVELOPMENT_BRANCH, LEGACY_DEVELOPMENT_BRANCH]) {
    try {
      const { data } = await github.rest.git.getRef({
        ...context.repo,
        ref: `heads/${name}`,
      });
      if (data.object?.type !== 'commit' || !data.object.sha)
        throw Error('Invalid development branch ref.');
      return { name, data };
    } catch (error) {
      // A transient error must never silently select a different branch.
      if (error.status !== 404 || name === LEGACY_DEVELOPMENT_BRANCH)
        throw error;
    }
  }
}

module.exports = { isDevelopmentBranch, getDevelopmentBranch };
