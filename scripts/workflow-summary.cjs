async function describeRun({ github, context, core, selection }) {
  const repo = `${context.repo.owner}/${context.repo.repo}`;
  const base = `${context.serverUrl}/${repo}`;
  const number =
    selection.kind === 'production'
      ? (
          await require('./deployment-policy.cjs').findMergedReleasePullRequest(
            { github, context },
          )
        ).number
      : selection.pr || context.payload.inputs?.pr;
  const stages = {
    update: '依存更新のstaging検証',
    restore: '開発用stagingへの復帰',
    development: '開発stagingの検証',
    production: '本番公開',
  };
  const summary = core.summary.addHeading(stages[selection.kind]);
  if (number && /^\d+$/.test(String(number))) {
    summary.addLink(`対象PR #${number}`, `${base}/pull/${number}`).addEOL();
    const { data: pr } = await github.rest.pulls.get({
      ...context.repo,
      pull_number: Number(number),
    });
    for (const issue of require('./issue-status.cjs').references(pr.body))
      summary
        .addLink(`関連Issue #${issue}`, `${base}/issues/${issue}`)
        .addEOL();
  }
  const source = context.payload.inputs?.source_run;
  if (source && /^\d+$/.test(source))
    summary.addLink('起動元の実行', `${base}/actions/runs/${source}`).addEOL();
  summary.addRaw(`対象ソース: ${selection.sha}`).addEOL();
  if (selection.kind === 'production')
    summary.addRaw(
      '本番公開後も開発同期・staging復帰が完了するまで関連Issueは未完了です。',
    );
  await summary.write();
}

module.exports = { describeRun };
