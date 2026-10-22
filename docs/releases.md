# 資材のバージョン管理

stagingはコミットSHA、productionはGitタグとGitHub Releaseで管理します。
初回は現在の `package.json` に合わせて `v0.1.0` とします。

## 公開PRで指定する内容

機能公開の `cloudflare-migration` または許可されたmain基準の依存更新ブランチから `main` へのPR本文に、次の形式で記載します。
PRテンプレートの案内コメントと仮の値は置き換えてください。

```markdown
Release-Version: v0.1.0

### DB変更・復旧

DB変更なし。直前のWorkerとのDB互換性に変更はありません。
今回の変更を戻す際は、対象ReleaseとCloudflareのバージョンを照合します。
```

`Release-Version` は本文中に1行だけ指定し、`package.json` の `version` と一致させます。
次回以降は最新の正式Releaseより大きい番号を使います。互換性を壊す変更はMAJOR、
機能追加はMINOR、不具合修正はPATCHを上げます。番号の意味はPRでレビューします。
依存関係を変更しない採番だけの変更ではlockfileの更新は不要です。
PRチェックは形式、一致、既存タグとの衝突、最新Releaseとの順序を確認します。

DB変更がある場合は、新規マイグレーション名、旧Workerとの互換性、必要なバックアップ、
復旧手順を具体的に記載します。DB変更がない場合も、その旨と互換性を記載します。
関連Issueは既存の運用どおり `Refs #49` のように独立した行で記載します。

番号を含むソースの変更はstagingへ再反映して確認します。
本文だけの変更でもPRチェックを再実行します。
ユーザーによるstaging確認・PR作成・マージと、既存の本番デプロイ制御は維持します。

## 稼働中の版を調べる

- staging: https://tsuri-kiroku-staging.keisuke0322.workers.dev/api/version
- production: https://tsuri-kiroku-production.keisuke0322.workers.dev/api/version

`/api/version` は、環境、稼働SHA、正式版の番号（stagingは `null`）、ビルド日時、
Actions実行ID・再実行番号、CloudflareのWorkerバージョンID・作成日時を返します。
ログイン不要の読み取り専用APIで、秘密情報・利用者情報・設定値は返しません。
`Cache-Control: no-store` で古い版のキャッシュを避けます。
ローカルなど識別情報を設定していない環境では503を返します。

本番の番号は配信中のWorkerに設定した公開予定番号です。Release作成だけ失敗した場合も
この番号が表示されるため、正式Releaseの作成結果はActionsの `Publish Release` を確認します。
本番失敗時も自動ロールバックは行いません。APIは実際に応答するWorkerの情報です。

ActionsのDeployジョブのサマリーと `deployment-record-実行ID-再実行番号` のartifactには、
稼働SHA、検証したstagingのSHAとdeployment ID（機能公開はGitHub、依存更新はCloudflare）、本番PR、関連Issue、
Cloudflare deployment IDとWorker version ID、検証日時を記録します。
同じSHAの再デプロイはActions実行ID・再実行番号とCloudflareの識別子で区別します。
文書だけの変更で以前のstaging検証を再利用した場合は、実際に検証した祖先SHAも残ります。

## Release作成と失敗時の再試行

本番のデプロイ・起動確認・DB適用確認・稼働情報の照合に成功した後、
独立した `Publish Release` ジョブが本番コミットへのタグと正式Releaseを作成します。
stagingはタグ・Releaseを作成しません。本番公開に失敗した場合も作成しません。

Release本文にPRから生成した変更履歴、公開PR・関連Issue、DB変更・復旧の注意、
デプロイ記録を残します。公開済みタグは移動・再利用せず、変更には新しい番号を使います。
すでに別コミットを指すタグがあれば停止します。

本番の反映が成功しRelease作成だけ失敗した場合は、失敗した実行を開き
**Re-run failed jobs** を選びます。成功済みDeployジョブは再実行せず、保存した記録を使います。
同じコミットへのタグが作成済みなら再利用し、同じReleaseが作成済みなら重複作成しません。
過去の実行の再試行で新しいReleaseのLatest指定を奪うこともありません。
本番のIssueはRelease作成も成功した後に完了・クローズします。

成功・失敗の記録artifactは90日間保持します。正式Release本文の記録はその後も参照できます。
artifactの期限切れ後はこの再試行方法を利用できません。タグの移動や本番の無断再配信で
代替せず、記録を照合して復旧方針を決めます。

## 資材の再作成・復旧

ビルド済みWorker・設定・認証情報をGitHubのartifactやRelease添付として配布しません。
ソース、lockfile、マイグレーションは本番タグ／コミットで保持し、デプロイ記録には
Node・pnpmの版、lockfileとSQLのSHA-256、環境別生成設定のSHA-256、適用済みSQL名を残します。
生成設定の内容やSecretsは記録しません。環境別Variables・SecretsはGitHubとCloudflareで管理します。

再作成は対象タグを別の作業ディレクトリにcheckoutし、記録のNode・pnpmを用意して
`corepack pnpm install --frozen-lockfile`、対象環境の設定生成、
`CF_CONFIG=wrangler.deploy.json corepack pnpm build` の順で行います。
詳細な設定は [Cloudflare運用手順](../CLOUDFLARE-MIGRATION.md) を参照してください。
当時の環境別VariablesとSecretsは運用者が別途確認します。ビルド日時等を含むため
成果物のバイト単位の一致は保証しません。

復旧前に対象ReleaseのDB注意事項、記録のSQLと実際の適用状況、Cloudflareの
稼働バージョンを照合します。**Workerを戻してもDBは戻りません。**
互換性がなければ古いWorkerを配信せず、追加修正またはバックアップからの復旧を判断します。
破壊的な復旧には既存のバックアップ・D1 Time Travel手順を使い、本番の操作はユーザーの指示で行います。

main基準の依存更新PRでは[依存更新の運用](dependency-updates.md)のprepare処理が最新の正式Releaseから次のPATCH版を準備する。管理者が番号を変更した場合も、番号を含むソースのCI・staging・動作確認をやり直す。依存更新でも本書のRelease・DB・稼働情報の条件を維持する。
