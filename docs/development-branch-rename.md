# developブランチでの開発

開発・staging用のブランチは `develop`、本番用は `main` です。
名前変更は完了しており、コードとWorkflowもこの2つの名前を使用します。

## GitHubの設定

- staging EnvironmentのDeployment branches and tagsは、Branchの `develop` と `main` を許可します。
- productionは `main` だけを許可します。
- 使わなくなったブランチの許可ルールが残っている場合は削除します。
- 依存更新のソースブランチを直接許可せず、mainの信頼済みcontrollerで検証します。

## ローカルの追跡先

名前変更前からのローカルブランチを使っている場合、現在のブランチ名を確認し、
作業内容を保持したまま `develop` に名前を変更します。
すでにdevelopを使用している場合、名前変更のコマンドは不要です。

```bash
git branch --show-current
git fetch github
# 現在のブランチが開発用で、名前がdevelopではない場合だけ実行します。
git branch -m develop
git branch --set-upstream-to=github/develop develop
```

## デプロイと公開

- developへのpushはstagingの検証を起動します。
- 手動で再検証する場合は、Actions → Deploy Cloudflareを `develop`、`action=development` で実行します。
- 本番公開は、staging確認後に `develop → main` のPRをユーザーがマージして行います。
- 公開後のmainからdevelopへの同期は維持します。
  同一内容のstaging検証を再利用する条件は[検証記録の再利用](staging-validation-reuse.md)を参照してください。
