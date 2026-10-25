const { readJson } = require('./dependency-state.cjs');

const ranks = { patch: 1, minor: 2, major: 3 };

function titleWithCategory(title, category) {
  const base = (title || '').replace(
    /^(?:\[(?:緊急|通常・メジャー|通常・マイナー／パッチ|通常・要確認|要確認)\]\s*)+/,
    '',
  );
  return Array.from(`[${category}] ${base}`).slice(0, 256).join('');
}

function metadataFromCommits(commits) {
  const names = new Set();
  const types = [];
  let unknown = false;
  for (const commit of commits) {
    if (
      commit.author?.login !== 'dependabot[bot]' ||
      commit.commit?.verification?.verified !== true
    )
      continue;
    const block =
      commit.commit.message.match(
        /^---\r?\n([\s\S]*?)^\.\.\.(?:\r?\n|$)/m,
      )?.[1] || '';
    let nameCount = 0,
      typeCount = 0;
    for (const match of block.matchAll(
      /^\s*-\s*dependency-name:\s*(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/gm,
    )) {
      names.add(match[1] || match[2] || match[3]);
      nameCount++;
    }
    for (const match of block.matchAll(
      /^\s*update-type:\s*['"]?version-update:semver-(major|minor|patch)['"]?\s*$/gm,
    )) {
      types.push(match[1]);
      typeCount++;
    }
    // Indirect Dependabot updates may omit update-type. A single-package
    // verified commit still records the old and new versions in its body.
    if (nameCount === 1 && typeCount === 0) {
      const versions = commit.commit.message.match(
        /^Bumps .+ from (\d+)\.(\d+)\.(\d+) to (\d+)\.(\d+)\.(\d+)\.$/m,
      );
      if (versions) {
        const values = versions.slice(1).map(Number);
        const part = values
          .slice(0, 3)
          .findIndex((n, i) => n !== values[i + 3]);
        if (part >= 0) {
          types.push(['major', 'minor', 'patch'][part]);
          typeCount++;
        }
      }
    }
    if (nameCount !== typeCount) unknown = true;
  }
  return { names: [...names], types, unknown };
}

function manifestChanges(before, after) {
  const names = new Set();
  const types = [];
  let unknown = false;
  for (const group of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ]) {
    for (const [name, value] of Object.entries(after[group] || {})) {
      const old = before[group]?.[name];
      if (old === value) continue;
      names.add(name);
      const parse = (v) =>
        typeof v === 'string' &&
        v
          .match(/^[~^]?(\d+)\.(\d+)\.(\d+)$/)
          ?.slice(1)
          .map(Number);
      const left = parse(old),
        right = parse(value);
      if (!left || !right) {
        unknown = true;
        continue;
      }
      const part = left.findIndex((n, i) => n !== right[i]);
      if (part >= 0) types.push(['major', 'minor', 'patch'][part]);
    }
  }
  return { names: [...names], types, unknown };
}

async function classifiedTitle({ github, context, log = () => {} }, pr) {
  if (/^Emergency-Reason:\s*\S.+$/m.test(pr.body || ''))
    return titleWithCategory(pr.title, '緊急');
  try {
    let metadata;
    if (pr.user?.login === 'dependabot[bot]' && pr.user.type === 'Bot') {
      metadata = metadataFromCommits(
        await github.paginate(github.rest.pulls.listCommits, {
          ...context.repo,
          pull_number: pr.number,
          per_page: 100,
        }),
      );
    } else {
      metadata = manifestChanges(
        await readJson(github, context.repo, 'package.json', pr.base.sha),
        await readJson(github, context.repo, 'package.json', pr.head.sha),
      );
    }
    if (!metadata.names.length) return titleWithCategory(pr.title, '要確認');
    const alerts = await github.paginate(
      'GET /repos/{owner}/{repo}/dependabot/alerts',
      {
        ...context.repo,
        state: 'open',
        per_page: 100,
      },
    );
    const urgent = alerts.some((a) =>
      metadata.names.includes(
        a.dependency?.package?.name || a.security_vulnerability?.package?.name,
      ),
    );
    const type = metadata.types.sort((a, b) => ranks[b] - ranks[a])[0];
    const category = urgent
      ? '緊急'
      : type === 'major'
        ? '通常・メジャー'
        : type && !metadata.unknown
          ? '通常・マイナー／パッチ'
          : '要確認';
    return titleWithCategory(pr.title, category);
  } catch {
    log(`PR #${pr.number}: update classification unavailable; marked 要確認.`);
    return titleWithCategory(pr.title, '要確認');
  }
}

async function refreshDependabotTitle(options, pr) {
  if (
    pr.state !== 'open' ||
    pr.base?.ref !== 'main' ||
    pr.user?.login !== 'dependabot[bot]' ||
    pr.user.type !== 'Bot'
  )
    return;
  const title = await classifiedTitle(options, pr);
  if (title !== pr.title)
    await options.github.rest.pulls.update({
      ...options.context.repo,
      pull_number: pr.number,
      title,
    });
}

module.exports = {
  titleWithCategory,
  metadataFromCommits,
  manifestChanges,
  classifiedTitle,
  refreshDependabotTitle,
};
