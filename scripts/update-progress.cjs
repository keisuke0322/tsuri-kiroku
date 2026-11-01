class UpdatePending extends Error {
  constructor(stage, message, url) {
    super(message);
    this.name = 'UpdatePending';
    this.stage = stage;
    this.url = url;
  }
}

const marker = '<!-- dependency-update-progress -->';
async function publishProgress({ github, context }, pr, error) {
  const pending = error instanceof UpdatePending;
  const state = !error
    ? '✅ マージ可能'
    : pending
      ? `⏳ ${error.message}`
      : '❌ 検証・公開条件の確認に失敗';
  const next = !error
    ? 'PRの必須チェックがすべて成功していることを確認し、Create a merge commitでマージしてください。'
    : pending
      ? error.message
      : `原因を確認してください。\n\n${String(error.message).replaceAll('<', '&lt;')}`;
  const url =
    error?.url ||
    `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const body = `${marker}\n## 依存更新の現在の状態\n\n${state}\n\n${next}\n\n[確認画面を開く](${url})\n\n対象コミット: \`${pr.head.sha}\`\n\nこの案内は現在の状態に更新されます。過去のActionsの赤表示は履歴として残ります。`;
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...context.repo,
    issue_number: pr.number,
    per_page: 100,
  });
  const existing = comments.find(
    (c) =>
      c.body?.startsWith(marker) &&
      [context.repo.owner, 'github-actions[bot]'].includes(c.user?.login),
  );
  if (existing?.body === body) return;
  if (existing)
    await github.rest.issues.updateComment({
      ...context.repo,
      comment_id: existing.id,
      body,
    });
  else
    await github.rest.issues.createComment({
      ...context.repo,
      issue_number: pr.number,
      body,
    });
}

module.exports = { UpdatePending, publishProgress };
