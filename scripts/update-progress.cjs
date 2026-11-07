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
  const base = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}`;
  const workflow = `${base}/actions/workflows/cloudflare.yml`;
  const run = `${base}/actions/runs/${context.runId}`;
  const start = `「Run workflow」を開き、Branch: \`main\`、action: \`start-update\`、pr: \`${pr.number}\` を指定して実行してください。`;
  const state = !error
    ? '✅ マージ可能'
    : pending
      ? `${error.stage === 'tracking' && error.message.includes('失敗') ? '❌' : '⏳'} ${error.message}`
      : '❌ 検証・公開条件の確認に失敗';
  const staleBase = /Update branch must include current main/.test(
    error?.message || '',
  );
  const next = !error
    ? 'PRの必須チェックがすべて成功していることを確認し、Create a merge commitでマージしてください。'
    : pending && error.stage === 'start'
      ? `${error.message}\n\n${start}`
      : pending
        ? error.message
        : staleBase
          ? `更新ブランチに最新のmainが含まれていません。PRのUpdate branch、またはDependabotへの \`@dependabot rebase\` で更新してください。更新後、${start}`
          : `実行の失敗箇所を確認し、原因を解消してください。\n\n${String(error.message).replaceAll('<', '&lt;')}`;
  const url = error?.url || run;
  const refs = require('./issue-status.cjs').references(pr.body);
  const issues = refs
    .map((n) => `[Issue #${n}](${base}/issues/${n})`)
    .join('、');
  const body = `${marker}\n## 依存更新の現在の状態\n\n**現在：** ${state}\n\n**次の操作：** ${next}\n\n[確認画面を開く](${url}) · [検証開始の画面](${workflow})\n\n${issues ? `関連Issue：${issues}\n\n` : ''}対象コミット: \`${pr.head.sha}\`\n\nマージ後もこのPRから本番公開・開発用stagingへの復帰を追跡できます。PRはマージするとClosed一覧へ移動します。関連Issueは公開・開発同期・staging検証が完了するまで未完了です。過去のActionsの赤表示は履歴として残ります。`;
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
