# 開発ブランチをdevelopへ変更する手順

開発・staging用のブランチ名を `cloudflare-migration` から `develop` に変更します。
ブランチ名変更だけではActionsのコードやEnvironmentの許可設定は変わらないため、次の順序で実施します。

1. 移行対応を旧名の開発ブランチへpushし、stagingデプロイ・E2Eの成功を確認します。
2. 旧名からmainへの公開PRを作成し、ユーザーが確認・マージします。
   本番デプロイ・正式Release作成・mainから旧名への同期・同期後のstaging成功まで確認します。
3. GitHubのSettings → Environments → staging → Deployment branches and tagsで、
   Branchの `develop` を追加します。既存の `main` と旧名の許可はこの時点では残します。
   productionはmain限定のままにします。
4. Branches一覧の旧名の「…」→ Rename branchで `develop` へ変更します。
   新しいブランチの作成や旧ブランチの削除による代用はしません。
   名前変更前に、進行中のPR・依存更新のstaging占有・デプロイがないことを確認します。
5. Actions → Deploy Cloudflareを `develop`、`action=development` で実行し、
   Deploy・E2E・稼働版照合の成功を確認します。名前変更自体ではpushイベントは起きません。
6. stagingの旧名の許可を削除し、mainとdevelopの2件であることを確認します。
   既存のローカルチェックアウトのブランチ名と追跡先も更新します。

```bash
git branch -m cloudflare-migration develop
git fetch github
git branch --set-upstream-to=github/develop develop
```

この移行対応では両方の名前をイベント・公開元として認識します。
開発の最新先端・公開後の同期先・依存更新後の復帰先は、developが存在すればdevelop、
404で存在しないことを確認した場合だけ旧名を使います。
権限不足・API障害・不正なrefでは旧名へ切り替えず停止します。
developが存在する間、旧名から通常のstagingデプロイは実行できません。
移行後の標準の開発ブランチはdevelopです。旧名対応は過去の公開PRや移行前の実行との互換用です。

mainへの直接push、本番向けPRの自動マージ、公開チェックの省略は行いません。
main上の移行対応の公開が完了するまでGitHubの名前変更を確定しないでください。
