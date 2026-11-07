const { UpdatePending } = require('./update-progress.cjs');

// Handle only explicitly classified, expected waiting states. Unknown failures
// still fail the job. A paused run is not deployment or release evidence.
async function reportPending(core, error) {
  if (!(error instanceof UpdatePending)) throw error;
  core.setOutput('paused', 'true');
  core.notice(error.message);
  const summary = core.summary
    .addHeading('⏳ 保留：デプロイは実施していません')
    .addRaw(error.message)
    .addEOL()
    .addRaw(
      'この実行は保留で終了します。検証成功・公開可能を意味しません。PRの最新案内に従ってください。',
    );
  if (error.url) summary.addEOL().addLink('次の操作・確認画面', error.url);
  await summary.write();
}

module.exports = { reportPending };
