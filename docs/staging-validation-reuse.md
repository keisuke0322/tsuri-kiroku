# 公開後の同期で同じstaging検証を繰り返さない

mainからdevelopへの同期PRと、公開済みmain・最新CI・競合・先端SHAの照合は維持します。
同期後のファイル内容が検証済みの内容と完全に同じ場合、元の成功記録を再利用し、
stagingの再ビルド・再デプロイ・E2Eを省略します。整形・型チェック・単体テストは継続します。

## 再利用する条件

- developへのpushが、同一リポジトリの公開済みmainからの同期PRのマージである。
- 同期前の先端に成功したstaging検証記録があり、同期前後・実際にE2EしたソースのGit treeが完全一致する。
- 公開元が通常の開発ブランチである。main基準のDependabot／手動依存更新は対象外。
- 元のActionsのリポジトリ・ブランチ・SHA・run/attempt・E2E・稼働版照合・Deployジョブ・実行全体が成功している。
- lockfile・Node/pnpm・stagingの環境設定が同一である。
  設定比較から除くのは、SHA・実行ID・ビルド日時を含む生成メタデータAPP_BUILD_INFOだけ。
- 共有stagingが依存更新に占有されておらず、develop先端が変わっていない。
- 現在の/api/versionとCloudflare deployment/version、D1の適用済みマイグレーションが元の成功記録と一致する。

一つでも確認できない場合、通常のデプロイ・E2Eを実行します。
最初の導入時や記録がない場合も同じです。管理者が手動で通常の開発デプロイを起動した場合は再利用せず、
必ず再デプロイ・E2Eを行います。依存更新の検証・中止・復帰の処理は変更しません。

## 実行結果と記録

共有stagingの同時実行制御を維持した同じDeployジョブ内で判定・稼働版の読み取り確認を行います。
再利用時にGitHub上のstaging検証が成功しても、新しいWorkerを配信した意味ではありません。
Actionsのサマリーとdeployment-recordには、同期後の検証対象SHA、実際の稼働SHA、tree、元の成功実行へのリンクを示します。
/api/versionは、実際に配信中の元のSHA・実行IDを返し続けます。

成功記録はautomation/dependency-stateのlastDevelopmentValidationに保存します。
再利用分はstagingReusesにも直近50件までSHAごとに保存し、次の公開判定やIssue完了判定から参照します。
元の成功記録を手編集して再利用を成立させないでください。
再利用時も本番公開・正式Release・開発への取り込み・検証成功が揃うまでIssueを完了しません。
再利用した実行と元のE2E実行を再照合し、失敗した再実行・異なるattempt・内容不一致・記録欠落では停止します。

WorkerやDBに変更が入っていた場合、通常のデプロイ・E2Eで改めて確認します。
同じSHAで通常の検証を成功させた場合は、そのSHAに対する古い再利用記録を置き換えます。
