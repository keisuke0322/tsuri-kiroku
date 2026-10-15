const STATES = [
  '検討中',
  '開発中',
  'staging確認待ち',
  '本番反映待ち',
  '完了',
  '外部提案',
];
const COMMANDS = Object.fromEntries([
  ...[
    '外部提案',
    '検討中',
    '開発待ち',
    '開発中',
    'staging確認待ち',
    '本番反映待ち',
    '完了',
  ].map((name) => [`project:${name}`, ['Status', name]]),
  ...['高', '中', '低'].map((name) => [`priority:${name}`, ['優先度', name]]),
]);
const sameName = (a, b) => a?.trim().toLowerCase() === b.trim().toLowerCase();

async function loadProject({ github, ensureOptions = false, log = () => {} }) {
  const result = await github.graphql(
    `
    query($login: String!, $number: Int!) {
      user(login: $login) { projectV2(number: $number) { id } }
    }`,
    { login: 'keisuke0322', number: 7 },
  );
  const id = result.user?.projectV2?.id;
  if (!id) throw new Error('Project #7 not found; check PROJECT_TOKEN access');
  const fields = [];
  let after = null;
  do {
    const result = await github.graphql(
      `
      query($id: ID!, $after: String) {
        node(id: $id) { ... on ProjectV2 {
          fields(first: 100, after: $after) {
            nodes { ... on ProjectV2SingleSelectField { id name options { id name color description } } }
            pageInfo { hasNextPage endCursor }
          }
        } }
      }`,
      { id, after },
    );
    const connection = result.node.fields;
    fields.push(...connection.nodes.filter((f) => f.id));
    after = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (after);
  const field = fields.find((f) => f.name === 'Status');
  if (!field) throw new Error('Project #7 has no single-select Status field');
  const missing = STATES.filter(
    (name) => !field.options.some((o) => sameName(o.name, name)),
  );
  if (missing.length && ensureOptions) {
    // Preserve existing option IDs, names, colors and descriptions, including 開発待ち.
    const options = [
      ...field.options.map(({ id, name, color, description }) => ({
        id,
        name,
        color,
        description: description || '',
      })),
      ...missing.map((name) => ({
        name,
        color: name === '完了' ? 'GREEN' : 'BLUE',
        description: '',
      })),
    ];
    const updated = await github.graphql(
      `
      mutation($id: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
        updateProjectV2Field(input: { fieldId: $id, singleSelectOptions: $options }) {
          projectV2Field { ... on ProjectV2SingleSelectField { options { id name color description } } }
        }
      }`,
      { id: field.id, options },
    );
    field.options = updated.updateProjectV2Field.projectV2Field.options;
  }
  for (const name of STATES) {
    if (!field.options.some((o) => sameName(o.name, name)))
      throw new Error(`Missing Project Status option: ${name}`);
  }
  log(
    `Project #7 Status options: ${field.options.map((o) => o.name).join(', ')}`,
  );
  return { id, fields };
}

async function projectItem({
  github,
  context,
  number,
  project,
  add = true,
  kind = 'issue',
}) {
  if (!['issue', 'pullRequest'].includes(kind))
    throw new Error('Unknown content kind');
  let after = null;
  let issueId;
  do {
    const result = await github.graphql(
      `
      query($owner: String!, $repo: String!, $number: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
          ${kind}(number: $number) { id projectItems(first: 100, after: $after) {
            nodes { id project { id } }
            pageInfo { hasNextPage endCursor }
          } }
        }
      }`,
      { ...context.repo, number, after },
    );
    const issue = result.repository[kind];
    if (!issue) throw new Error(`Issue #${number} not found`);
    issueId = issue.id;
    const connection = issue.projectItems;
    const item = connection.nodes.find((i) => i.project.id === project.id);
    if (item) return item;
    after = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (after);
  if (!add) return null;
  const result = await github.graphql(
    `
    mutation($project: ID!, $issue: ID!) {
      addProjectV2ItemById(input: { projectId: $project, contentId: $issue }) { item { id } }
    }`,
    { project: project.id, issue: issueId },
  );
  return result.addProjectV2ItemById.item;
}

async function readValue({ github, item, fieldName }) {
  const result = await github.graphql(
    `
    query($id: ID!, $name: String!) {
      node(id: $id) { ... on ProjectV2Item {
        fieldValueByName(name: $name) { ... on ProjectV2ItemFieldSingleSelectValue { name optionId } }
      } }
    }`,
    { id: item.id, name: fieldName },
  );
  return result.node.fieldValueByName;
}

async function updateField({ github, project, item, fieldName, value }) {
  const field = project.fields.find((f) => f.name === fieldName);
  const option = field?.options.find((o) => sameName(o.name, value));
  if (!option)
    throw new Error(`Missing Project option: ${fieldName} / ${value}`);
  await github.graphql(
    `
    mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $project, itemId: $item, fieldId: $field,
        value: { singleSelectOptionId: $option }
      }) { projectV2Item { id } }
    }`,
    { project: project.id, item: item.id, field: field.id, option: option.id },
  );
  const actual = await readValue({ github, item, fieldName });
  if (actual?.optionId !== option.id)
    throw new Error('Project update readback did not match');
  return actual.name;
}

async function removeLegacyLabels({ github, context, number, labels }) {
  for (const label of labels) {
    const name = typeof label === 'string' ? label : label.name;
    if (!STATES.includes(name) || name === '外部提案') continue;
    try {
      await github.rest.issues.removeLabel({
        ...context.repo,
        issue_number: number,
        name,
      });
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
}

async function setStatus({
  github,
  context,
  number,
  status,
  initial = false,
  project,
  kind = 'issue',
  log = () => {},
}) {
  if (!STATES.includes(status)) throw new Error('Unknown Project Status');
  const args = { ...context.repo, issue_number: number };
  const { data: issue } = await github.rest.issues.get(args);
  if (Boolean(issue.pull_request) !== (kind === 'pullRequest'))
    throw new Error(`Unexpected content kind for #${number}`);
  if (status !== '完了' && issue.state === 'closed') return;
  project ||= await loadProject({ github });
  const item = await projectItem({ github, context, number, project, kind });
  const current = await readValue({ github, item, fieldName: 'Status' });
  // A delayed opened event must not overwrite any existing status, even 開発待ち.
  if (initial && current?.optionId) return;
  const actual = await updateField({
    github,
    project,
    item,
    fieldName: 'Status',
    value: status,
  });
  await removeLegacyLabels({ github, context, number, labels: issue.labels });
  log(`Issue #${number}: Project #7 Status = ${actual} (verified)`);
  if (kind === 'issue' && status === '完了' && issue.state !== 'closed') {
    await github.rest.issues.update({
      ...args,
      state: 'closed',
      state_reason: 'completed',
    });
  }
}

async function processCommand({ github, context, log = () => {} }) {
  const name = context.payload.label.name;
  const command = COMMANDS[name];
  if (!command) return;
  const permission = await github.rest.repos.getCollaboratorPermissionLevel({
    ...context.repo,
    username: context.actor,
  });
  if (!['admin', 'maintain', 'write'].includes(permission.data.permission))
    throw new Error('Project commands require repository write permission');
  const number = context.issue.number;
  const args = { ...context.repo, issue_number: number };
  const { data: issue } = await github.rest.issues.get(args);
  const kind = issue.pull_request ? 'pullRequest' : 'issue';
  if (!issue.labels.some((l) => (typeof l === 'string' ? l : l.name) === name))
    return;
  const project = await loadProject({ github });
  const item = await projectItem({ github, context, number, project, kind });
  const [fieldName, value] = command;
  const actual = await updateField({ github, project, item, fieldName, value });
  if (fieldName === 'Status')
    await removeLegacyLabels({ github, context, number, labels: issue.labels });
  await github.rest.issues.removeLabel({ ...args, name });
  log(
    `Issue #${number}: ${fieldName} = ${actual}; command label removed after verification`,
  );
}

async function bootstrap({ github, context, log = () => {} }) {
  const project = await loadProject({ github, ensureOptions: true, log });
  for (const name of Object.keys(COMMANDS)) {
    try {
      await github.rest.issues.getLabel({ ...context.repo, name });
    } catch (error) {
      if (error.status !== 404) throw error;
      await github.rest.issues.createLabel({
        ...context.repo,
        name,
        color: name.startsWith('project:') ? '1D76DB' : 'D93F0B',
        description:
          'Project #7 update command; removed after successful update',
      });
    }
  }
  try {
    await github.rest.issues.getLabel({ ...context.repo, name: '外部提案' });
  } catch (error) {
    if (error.status !== 404) throw error;
    await github.rest.issues.createLabel({
      ...context.repo,
      name: '外部提案',
      color: '7057FF',
      description: '外部からの要望・不具合報告・PR（出所の分類）',
    });
  }
  // Transfer previously introduced Issue status labels into Project Status.
  // Conflicting legacy labels are reported instead of guessing the intended status.
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo,
    state: 'all',
    per_page: 100,
  });
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const states = issue.labels
      .map((l) => (typeof l === 'string' ? l : l.name))
      .filter((l) => STATES.includes(l) && l !== '外部提案');
    if (!states.length) continue;
    if (states.length !== 1)
      throw new Error(
        `Issue #${issue.number} has conflicting legacy status labels`,
      );
    const item = await projectItem({
      github,
      context,
      number: issue.number,
      project,
    });
    const actual = await updateField({
      github,
      project,
      item,
      fieldName: 'Status',
      value: states[0],
    });
    await removeLegacyLabels({
      github,
      context,
      number: issue.number,
      labels: issue.labels,
    });
    log(
      `Migrated Issue #${issue.number}: Project Status = ${actual}; legacy Issue label removed`,
    );
  }
}

module.exports = {
  STATES,
  COMMANDS,
  loadProject,
  projectItem,
  readValue,
  updateField,
  setStatus,
  processCommand,
  bootstrap,
};
