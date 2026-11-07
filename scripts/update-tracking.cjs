const { publishProgress, UpdatePending } = require('./update-progress.cjs');

const active = (run) => run && run.status !== 'completed';
const failed = (run) =>
  run?.status === 'completed' && run.conclusion !== 'success';
const latest = (runs, predicate) =>
  runs.filter(predicate).sort((a, b) => b.id - a.id)[0];

// Display only: this observer never changes release gates, staging ownership or approval.
async function trackUpdates({ github, context }) {
  const options = { github, context };
  const {
    data: { workflow_runs: runs },
  } = await github.rest.actions.listWorkflowRuns({
    ...context.repo,
    workflow_id: 'cloudflare.yml',
    per_page: 100,
  });
  const { data: prs } = await github.rest.pulls.list({
    ...context.repo,
    state: 'all',
    base: 'main',
    sort: 'updated',
    direction: 'desc',
    per_page: 100,
  });
  const base = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}`;
  for (const listed of prs) {
    if (
      !listed.head.ref.startsWith('dependabot/') &&
      listed.user?.login !== 'dependabot[bot]'
    )
      continue;
    // Always re-read the PR: a workflow_run event may refer to an obsolete head.
    const { data: pr } = await github.rest.pulls.get({
      ...context.repo,
      pull_number: listed.number,
    });
    if (
      pr.merged_at &&
      Date.now() - Date.parse(pr.merged_at) > 7 * 24 * 60 * 60 * 1000
    )
      continue;
    const named = (r) => r.display_title?.startsWith(`PR #${pr.number}｜`);
    const validation = latest(
      runs,
      (r) => named(r) && /依存更新の(staging検証|再検証)/.test(r.display_title),
    );
    const restore = latest(
      runs,
      (r) => named(r) && /開発用stagingへ復帰/.test(r.display_title),
    );
    let current;
    let message;
    if (pr.merged_at) {
      const production = latest(
        runs,
        (r) =>
          r.event === 'push' &&
          r.head_branch === 'main' &&
          r.head_sha === pr.merge_commit_sha,
      );
      current = restore || production;
      if (restore) {
        message = failed(restore)
          ? '開発用stagingへの復帰に失敗しました。実行の失敗箇所を確認してください。'
          : active(restore)
            ? '本番公開後の開発用stagingへの復帰待ち・実行中です。次の操作は不要です。'
            : '開発用stagingへの復帰・自動テストが成功しました。関連Issueの完了は、開発同期と最新の開発ソースのstaging検証も照合する別処理で判定します。';
      } else {
        message = failed(production)
          ? 'マージ済みですが本番公開処理に失敗しました。実行の失敗箇所を確認してください。'
          : production?.conclusion === 'success'
            ? '本番公開処理が成功しました。開発同期・staging復帰の開始待ちです。次の操作は不要です。'
            : 'マージ済み・本番公開の開始待ち／実行中です。マージだけでは全処理完了ではありません。次の操作は不要です。';
      }
    } else if (pr.state === 'open' && active(validation)) {
      current = validation;
      const blocker = latest(
        runs,
        (r) => r.id !== validation.id && r.status === 'in_progress',
      );
      message =
        validation.status === 'in_progress'
          ? 'staging検証を実行中です。準備・CI待ち・デプロイ・自動テストを連続実行します。次の操作は不要です。'
          : `staging検証は開始待ちです。再実行は不要です。${blocker ? `先行処理：[${blocker.display_title}](${base}/actions/runs/${blocker.id})。` : 'GitHubの実行枠・同時実行制御による待機の可能性があります。'}`;
    } else if (pr.state === 'open') {
      // Evaluate current evidence, not the result or SHA of the triggering event.
      let error;
      try {
        await require('./dependency-policy.cjs').requireUpdateEvidence(
          options,
          pr,
        );
        const manifest = await require('./dependency-state.cjs').readJson(
          github,
          context.repo,
          'package.json',
          pr.head.sha,
        );
        await require('./release-policy.cjs').validateRelease({
          github,
          context,
          pr,
          packageVersion: manifest.version,
        });
      } catch (e) {
        error = e;
      }
      await publishProgress(options, pr, error);
      continue;
    } else continue;
    if (current?.status === 'in_progress') {
      const {
        data: { jobs },
      } = await github.rest.actions.listJobsForWorkflowRun({
        ...context.repo,
        run_id: current.id,
        filter: 'latest',
        per_page: 100,
      });
      const step = jobs
        .flatMap((job) => job.steps || [])
        .find((item) => item.status === 'in_progress');
      if (step) message += ` 現在の処理：${step.name}。`;
    }
    const url = current
      ? `${base}/actions/runs/${current.id}`
      : `${base}/actions/workflows/cloudflare.yml`;
    await publishProgress(
      options,
      pr,
      new UpdatePending('tracking', message, url),
    );
  }
}

module.exports = { trackUpdates };
