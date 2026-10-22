# 釣果ノートの開発ルール

このファイルはリポジトリ全体に適用するAI向け作業指針です。別のチャットで作業する場合も最初に読み、現在のブランチ・作業差分・関連Issueを確認してください。ユーザーの明示的な指示を優先し、同じ作業について既に得た指示を再確認しないでください。

## プロジェクトと環境

- GitHub: `keisuke0322/tsuri-kiroku`。このチェックアウトのGitHub向けremoteは`github`。`origin`は旧Sites用なので、push前にURLを確認し、旧Sitesへはpushしない。
- React / TypeScript / Vinext、Cloudflare Workers / D1 / R2、Google認証を使用する。
- 開発ブランチ: `cloudflare-migration`（継続利用）。本番ブランチ: `main`。
- staging: https://tsuri-kiroku-staging.keisuke0322.workers.dev
- production: https://tsuri-kiroku-production.keisuke0322.workers.dev
- 詳細は[README.md](README.md)、[CLOUDFLARE-MIGRATION.md](CLOUDFLARE-MIGRATION.md)、実際の[ワークフロー](.github/workflows/cloudflare.yml)を確認する。環境やブランチ構成を推測で変更しない。

## コーディング規約と整形

- TypeScript・JavaScriptは[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)を基本とする。既存のフレームワーク要件と、このリポジトリの明示的な設定を優先する。規約への対応を理由に、依頼と無関係な命名変更・構造変更を行わない。
- 機械的な書式は `.prettierrc.json` を正とし、Prettierで統一する。インデントはスペース2文字、折り返し幅は80文字、文字列は原則シングルクォート（JSX属性はダブルクォート）、文末はセミコロン、改行はLFとする。URL・文字列などは80文字を超える場合がある。
- importのまとまりと本文の間、関数・型・クラスの定義の間には空行を入れる。関数内では入力検証・データ取得・更新・戻り値など、意味のある処理のまとまりの間に必要に応じて空行を入れる。各文の間に機械的に空行を入れず、ブロックの先頭・末尾の空行や連続する空行は避ける。
- Prettierは意味に応じた空行を自動追加しない。開発者・AIが空行を調整してから `corepack pnpm run format` を実行し、`corepack pnpm run format:check` と差分を確認する。CIでも整形チェックを実行する。
- `.prettierignore` に指定した第三者のソース、生成ファイル、適用済みDBマイグレーションなどは整形しない。JSONCは既存スクリプトの読み込みとの互換性のため末尾カンマを付けない。
- ESLintは既存の品質・React関連ルールを担当する。PrettierやESLintがGoogle規約全体への準拠を保証するとは扱わず、命名や構造、空行はレビューでも確認する。

## 仕様検討とIssue登録

1. ユーザーと仕様を整理する。目的、期待する動作、対象外、完了条件、確認項目を明確にし、既存コードから分かることは先に調べる。
2. Issue登録の指示を受けたら、既存Issueとの重複を確認し、GitHubに登録する。指示には仕様検討と登録をまとめた依頼も含む。
3. Issueには「目的」「仕様」「対象外」「完了条件」「確認項目」を記載する。必要な場合だけDB変更・互換性・未決事項を追記し、未決事項を確定仕様として扱わない。
4. 登録後はIssue番号とURLを報告する。Issue登録だけの依頼で実装やデプロイを開始しない。

## 実装からstagingまで

1. 開発指示を受けたら、関連Issueと完了条件を確認する。Issueがない軽微な修正では、Issue作成を必須の障壁にしない。
2. 未コミット変更を確認し、ユーザーの変更を保持する。開発前に`github`から最新状態を取得し、`cloudflare-migration`へ最新の`github/main`を取り込む。未コミット変更を勝手に破棄・上書きしない。
3. 指定された範囲を実装する。既存デザイン・認証・権限制御を維持し、不要なライブラリを追加しない。
4. 機能変更では以下を実行し、変更に応じて回帰確認とPC・スマートフォンの操作確認を行う。
   - `corepack pnpm run typecheck`
   - `corepack pnpm test`
   - `corepack pnpm build`
5. 説明書のみの変更では、記載内容と実際の設定の整合性、差分の確認を行う。実行コードを変えない場合、型チェック・テスト・ビルドのローカル再実行は不要。
6. 通常の機能開発依頼は、検証後のコミット・`github`の`cloudflare-migration`へのpush・staging反映までを含む。ユーザーがローカル作業のみ等を指定した場合は、その範囲に従う。
7. push後はGitHub Actionsの終了を確認する。失敗した場合は原因を調べ、成功していないデプロイを完了と報告しない。
8. 変更内容、検証結果、staging URL、ユーザーに確認してほしい操作を簡潔に報告する。実施できていない確認は明示する。

## ユーザー確認から本番公開まで

1. stagingでの受け入れ確認はユーザーが行う。ユーザーから確認完了とPR作成の指示を受けたら、AIが`cloudflare-migration`から`main`へのPRを作成する。明示的に依頼された場合は確認前のドラフトPRも作成できる。
2. PRには変更の目的・最終的な動作・検証結果・関連Issueを記載する。対応が完了するIssueはPR本文の独立した行に`Refs #番号`で関連付ける（複数は`Refs #12, #13`）。本番デプロイ成功後にActionsが閉じるため、`Closes`・`Fixes`・`Resolves`は使わない。PRのURLを報告し、Codexのチャットにも添付する。
   公開PRには[資材のバージョン管理](docs/releases.md)に従い、`package.json`と一致する`Release-Version: vMAJOR.MINOR.PATCH`と`### DB変更・復旧`を記載する。本番デプロイとRelease作成の両方が成功してからIssueが完了する。Release作成だけの失敗は失敗ジョブのみ再実行し、公開済みタグを移動しない。
3. `PR checks`の成功を確認する。ワークフローはPR先端コミットのstaging成功を検証する。確認後に追加修正をpushした場合は、その変更をstagingで再確認してもらう。
4. 1人運用のため承認レビューを必須にせず、ユーザー自身がPRを確認・マージする。AIは独断でマージしない。
5. 継続利用する開発ブランチなので、マージ方法は`Create a merge commit`とし、`cloudflare-migration`は削除しない。
6. mainへのマージでGitHub Actionsがmainのコードをproductionへ自動デプロイする。mainへ直接pushしない。ブランチ保護やデプロイ検証を迂回しない。
7. 本番への手動デプロイ・再実行は、ユーザーが指示した場合に行う。手動ワークフローもmainはproduction、cloudflare-migrationはstagingに対応する。

## DB・写真・秘密情報

- stagingとproductionは別のWorkers・D1・R2を使用する。テスト環境を本番DBへつなぎ替えたり、テストデータを本番へ自動コピーしたりしない。
- DB変更はスキーマと新規マイグレーションを追加して管理し、適用済みSQLを変更しない。同じ変更をstagingで検証してからproductionへ適用する。
- Actionsは各環境の互換性のあるDBマイグレーション後にWorkerをデプロイする。Issue #37の公開フラグ削除（0009）だけは、ログイン必須のWorkerの動作確認とD1 Time Travelの復旧bookmark取得後に適用する（[復旧手順](CLOUDFLARE-MIGRATION.md#db変更と戻し方)）。破壊的変更では既存データのバックアップと復旧手順を用意する。Workerを戻してもDBは元に戻らない。
- 秘密情報はコード・Issue・PR・チャット・ログへ記載しない。GitHubの環境別SecretsとWorkerのSecretsを使う。
- 無料枠での運用を意識し、不要なD1・R2アクセスや有料サービスの追加を避ける。

## E2Eテスト

- 機能を追加・変更したら、関連する `cypress/e2e` のテストを確認し、必要に応じて追加・修正する。期待結果はIssue・仕様・受け入れ条件を根拠とし、実装の動作だけを正解としない。
- 主要なユーザー操作、保存後・再読み込み後の反映、アクセス権限を優先する。細かな入力パターンは単体・結合テストに任せる。不具合修正では適切な層に再発防止テストを追加する。
- 要素指定には `data-cy`、保存結果の対象指定には作成時のIDを使う。固定時間の待機を避け、API応答や画面の状態を待つ。
- stagingでは依頼者本人のアカウントを利用する。テスト実行で作成した釣果だけを操作・削除する。既存の釣果・プロフィールを変更しない。
- 各テストは独立したデータを用意し、ランナーが生成する実行マーカーをメモに保持する。編集・削除用データはAPI経由で準備できる。
- `corepack pnpm run e2e:staging` はstaging限定。CIはデプロイ・起動確認後、同じジョブで実行する。デプロイからE2E完了まで同時実行を制御し、本番環境では実行しない。
- 認証情報・セッションはコード・Issue・ログ・成果物に含めない。Googleパスワードや本番セッションをCIへ登録しない。
- 失敗を通すためだけに検証を削除・緩和しない。テストの変更内容、実行結果、未検証事項（Google画面でのログイン、別ユーザー未設定時の権限検証など）を作業完了時に報告する。
- 設定と認証・後片付けの詳細は [docs/e2e.md](docs/e2e.md) を確認する。

## GitHub ProjectのStatus管理（必須）

- 状態は [Project #7](https://github.com/users/keisuke0322/projects/7) の単一選択フィールド `Status` で管理する。値は `外部提案` / `検討中` / `開発中` / `staging確認待ち` / `本番反映待ち` / `完了`。通常のIssueラベルで状態を管理しない。既存の `開発待ち` と優先度は保持する。
- AIがIssueを登録したら `project:検討中`、開発依頼で実装に着手する前には `project:開発中` を付ける。既存ActionsがProjectへ追加・Statusを変更し、読み戻し確認後に操作用ラベルを外す。GitHubへの反映とActions成功を確認する。変更できなければ黙って省略せず報告する。
- 開発コミットのメッセージに独立した行で `Refs #番号` を記載する（複数は `Refs #12, #13`）。stagingへのpush前に対象Issueの記載漏れがないことを確認する。
- stagingデプロイ・動作確認・E2Eがすべて成功した後、Actionsが対象IssueのProject Statusを `staging確認待ち` に変更する。
- main向けPR本文に今回本番へ反映する全対象Issueを `Refs #番号` で記載する。PRイベントActionsがProject Statusを `本番反映待ち` に変更する。既存PRに追加修正をpushした場合も、staging成功後のActionsがStatusを更新する。
- productionデプロイ・起動確認が成功した後、Actionsがマージ済みPR本文の対象IssueのProject Statusを `完了` に変更して閉じる。AIはマージ時点で完了にしない。
- Project更新の操作用ラベルは `project:staging確認待ち` / `project:本番反映待ち` / `project:完了` も利用できる。デプロイ失敗時に操作用ラベルで状態を先に進めない。
- `外部提案` は外部由来を示す分類ラベルでもある。Status変更後も分類ラベルを保持し、旧状態ラベルとして除去しない。外部PRはProject画面でStatusを変更する。判定・通知設定は [docs/external-proposals.md](docs/external-proposals.md) を参照する。
- 通常のIssue分類ラベルとProjectの優先度・ほかの項目は変更しない。誤って導入した5種類のIssue状態ラベルは、Project Statusの更新を読み戻し確認した後でのみ外す。
- 仕組みと有効化条件は [docs/issue-status.md](docs/issue-status.md) を参照する。

## 依存更新の公開

- main基準の依存更新PRは[依存更新の運用](docs/dependency-updates.md)に従う。通常の機能開発とは別ルートで、mainへの導入・setup成功後に有効となる。
- 更新PRのCI成功後も共有stagingへ自動反映しない。管理者によるprepare、対象PRを指定したvalidate-update、E2E・稼働版照合、動作確認済みラベルの監査記録を要求する。
- `automation/dependency-state` は占有と確認の制御記録。削除や手編集で解除しない。失敗時も占有を保持し、明示的な中止・復帰手順を使う。
- 公開成功後の同期PRは公開済みmainから開発へ向ける。自動マージ・開発ブランチのreset・未公開mainの同期を行わない。
- 未対応Dependabot更新と未同期mainは機能公開を止める。保留は管理者の理由付き30日期限とし、古い成功チェックやラベルで迂回しない。必要なGitHub設定・実更新・通知の未確認を明示する。
