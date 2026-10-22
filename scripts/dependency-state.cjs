// This branch is a durable control record, never a source/deployment branch.
const STATE_REF = 'automation/dependency-state';
const STATE_FILE = '.dependency-state.json';

async function optional(request) {
  try {
    return (await request()).data;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function readJson(github, repo, path, ref) {
  const { data } = await github.rest.repos.getContent({ ...repo, path, ref });
  if (data.type !== 'file' || data.encoding !== 'base64' || !data.content)
    throw Error(`Cannot read ${path} at ${ref}.`);
  return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
}

async function readState({ github, context }) {
  const ref = await optional(() =>
    github.rest.git.getRef({ ...context.repo, ref: `heads/${STATE_REF}` }),
  );
  if (!ref) return { revision: null, lease: null, deferrals: {}, manuals: {} };
  const state = await readJson(
    github,
    context.repo,
    STATE_FILE,
    ref.object.sha,
  );
  if (state.schema !== 1 || !state.deferrals || !state.manuals)
    throw Error('Unsupported dependency control state.');
  return { ...state, revision: ref.object.sha };
}

async function writeState({ github, context }, state) {
  const parent =
    state.revision ||
    (await github.rest.git.getRef({ ...context.repo, ref: 'heads/main' })).data
      .object.sha;
  const { data: commit } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: parent,
  });
  const { revision, ...value } = state;
  const { data: tree } = await github.rest.git.createTree({
    ...context.repo,
    base_tree: commit.tree.sha,
    tree: [
      {
        path: STATE_FILE,
        mode: '100644',
        type: 'blob',
        content: JSON.stringify({ ...value, schema: 1 }, null, 2) + '\n',
      },
    ],
  });
  const { data: next } = await github.rest.git.createCommit({
    ...context.repo,
    message: 'chore: record dependency release control state',
    tree: tree.sha,
    parents: [parent],
  });
  if (revision) {
    // Fast-forward only: concurrent writers from the same revision cannot both win.
    await github.rest.git.updateRef({
      ...context.repo,
      ref: `heads/${STATE_REF}`,
      sha: next.sha,
      force: false,
    });
  } else {
    await github.rest.git.createRef({
      ...context.repo,
      ref: `refs/heads/${STATE_REF}`,
      sha: next.sha,
    });
  }
  state.revision = next.sha;
}

async function requireAdmin({ github, context }, actor) {
  const selected = actor || context.actor;
  const actors = new Set([selected]);
  // A rerun is authorized by its triggering actor, not only the original actor.
  if (!actor && process.env.GITHUB_TRIGGERING_ACTOR)
    actors.add(process.env.GITHUB_TRIGGERING_ACTOR);
  for (const username of actors) {
    const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
      ...context.repo,
      username,
    });
    if (data.permission !== 'admin')
      throw Error('Repository administrator required.');
  }
  return selected;
}

async function currentMain({ github, context }) {
  return (await github.rest.git.getRef({ ...context.repo, ref: 'heads/main' }))
    .data.object.sha;
}

module.exports = {
  STATE_REF,
  optional,
  readJson,
  readState,
  writeState,
  requireAdmin,
  currentMain,
};
