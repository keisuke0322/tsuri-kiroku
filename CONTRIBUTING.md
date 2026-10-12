# 貢献ガイド

「つりめぐり」への機能要望、不具合報告、コードの提案を受け付けています。ローカル環境の作り方は[README](README.md#ローカルで開発する)を参照してください。

## 要望・不具合をIssueに投稿する

GitHubアカウントでログインし、[既存Issue](https://github.com/keisuke0322/tsuri-kiroku/issues)を確認してから「New issue」で「機能要望」または「不具合報告」のフォームを選び、投稿してください。fork・clone・push・PRは不要です。

- **要望**：困っていること、目的、希望する動作、利用場面。代替案があれば併記してください。
- **不具合**：再現手順、期待する動作、実際の動作、端末・ブラウザ。必要に応じてスクリーンショットを添えてください。

認証情報や個人情報を記載しないでください。投稿は検討の入口であり、採用・実装・対応時期を確約するものではありません。大きな変更は、実装前にIssueで目的や範囲を相談してください。

## forkからPRを提出する

### 1. forkする

[元リポジトリ](https://github.com/keisuke0322/tsuri-kiroku)の「Fork」から、自分のGitHubアカウントへコピーします。「Copy the main branch only」のチェックを外すと開発ブランチもコピーできます。mainだけをコピーした場合でも、以下の手順で元リポジトリから開発ブランチを取得できます。

**開発のベースとPRの提出先は `cloudflare-migration` です。** `main` は本番用です。

### 2. cloneし、元リポジトリをupstreamに登録する

`YOUR_GITHUB_USERNAME` を自分のGitHubユーザー名に置き換えて実行します。

```sh
git clone https://github.com/YOUR_GITHUB_USERNAME/tsuri-kiroku.git
cd tsuri-kiroku
git remote add upstream https://github.com/keisuke0322/tsuri-kiroku.git
git fetch upstream
```

この手順では `origin` が自分のfork、`upstream` が元リポジトリです。`git remote -v` で向き先を確認できます。

### 3. 最新の開発ブランチから作業ブランチを作る

例として `feat/your-change` を使います。変更内容に合わせてブランチ名を付けてください。

```sh
git switch --create feat/your-change --no-track upstream/cloudflare-migration
```

[READMEのローカル開発手順](README.md#ローカルで開発する)に従って、依存関係、`.dev.vars`、ローカルDBを用意して開発します。Google認証は自分のローカル用OAuthクライアントを使用します。元サイトのSecrets・本番データを取得する必要はありません。

作業中に元リポジトリの変更を取り込む場合は、変更をコミットしたうえで、作業ブランチ上で次を実行します。競合が発生した場合は解消してから検証してください。

```sh
git fetch upstream
git merge upstream/cloudflare-migration
```

### 4. 検証する

```sh
corepack pnpm run typecheck
corepack pnpm test
corepack pnpm build
```

機能変更では関連するテストを追加・更新し、PC・スマートフォンで操作を確認してください。不具合修正では、再発を検知できるテストを追加します。実行コードを変えない説明書だけの変更では、設定との整合性、リンク、差分を確認します。

DB変更はスキーマと新規マイグレーションで管理し、適用済みSQLを変更しません。認証・権限制御を維持し、秘密情報や生成されたローカルデータをコミットしないでください。

### 5. 自分のforkへpushする

変更したファイルを指定してコミットします。以下の `README.md` は例なので、実際に変更したファイルに置き換えてください。

```sh
git diff --check
git status
git add README.md
git commit -m "Describe your change"
git push --set-upstream origin feat/your-change
```

push先は自分のforkの `origin` です。forkへのpushだけでは元リポジトリやサイトへ変更は反映されません。

### 6. 元リポジトリへPRを提出する

GitHubで元リポジトリの「Pull requests」→「New pull request」→「compare across forks」を開き、次を指定します。

| 項目 | 指定する内容 |
| --- | --- |
| base repository | `keisuke0322/tsuri-kiroku` |
| base branch | `cloudflare-migration` |
| head repository | 自分のfork |
| compare branch | `feat/your-change` などの作業ブランチ |

PRには、変更の目的、変更後の動作、関連Issue、検証結果、未確認事項を記載してください。必要に応じて画面のスクリーンショットを添えます。未実行の確認は成功扱いにしないでください。

外部PRは提案の段階です。Issueの状態を進める操作用ラベルや、Issueを自動クローズする `Closes`・`Fixes`・`Resolves` は使用せず、関連Issueを通常のリンクで記載してください。公開用の `Refs` は管理者が取り込み・公開時に整理します。

レビューで修正が必要になった場合は、同じ作業ブランチで修正・検証・コミットし、`git push` します。同じPRに追加の変更が反映されます。

## 管理者による受付と公開

外部Issue・PRには「外部提案」の分類ラベルが付き、Projectの初期Statusも「外部提案」になります。確認後にStatusが進んでも分類ラベルは残ります。write・maintain・admin権限を持つ投稿者とBotは外部分類から除外します。

### 外部PRの自動チェック

`cloudflare-migration` 宛てのPRを作成・更新すると、`Contribution checks` がNode.js 24で型チェック・単体／結合テスト・ビルドを実行します。通常の `pull_request` イベントを使い、Cloudflare・Project等のSecrets、デプロイ環境、認証付きE2Eにはアクセスしません。checkoutの認証情報は作業ディレクトリに保持しません。

初回のfork投稿などでは、GitHubが管理者によるActions実行承認を求めることがあります。管理者は変更内容を確認して承認してください。チェック失敗時はログを確認し、同じ作業ブランチで修正してpushします。main宛ての公開用 `PR checks` とは別のチェックです。

### 取り込みから本番公開まで

1. 管理者が変更内容・関連Issue・`Contribution checks` の成功を確認し、必要な修正を依頼します。
2. 管理者が外部PRを `Create a merge commit` で元リポジトリの `cloudflare-migration` へマージします。作者情報とコミット履歴を保持し、外部PRはこの時点で自動的に閉じます。
3. マージ画面のコミットメッセージに、管理者が確認した関連Issueを独立した行で `Refs #123` として記載します（複数は `Refs #123, #124`）。自動クローズする `Closes`・`Fixes`・`Resolves` が混入していないか、PR本文・コミットメッセージを事前に確認してください。
4. マージによるpushでstagingへデプロイし、起動確認・認証付きE2E・ユーザーによる操作確認を行います。成功後、関連Issueは「staging確認待ち」になります。失敗時は関連Issueを開いたまま修正を追跡します。
5. 管理者が `cloudflare-migration → main` の公開PRを作成し、本番へ反映する全関連Issueを独立した行の `Refs` で記載します。関連Issueは「本番反映待ち」になります。
6. `PR checks` の成功とユーザー確認後、ユーザーが `Create a merge commit` でmainへマージします。継続利用する `cloudflare-migration` は削除しません。
7. 本番デプロイ・起動確認の成功後、既存Actionsが関連Issueを閉じ、Project Statusを「完了」にします。

**外部PRのクローズは「変更の受け入れ」、関連Issueのクローズは「本番反映の成功」を意味します。** 外部PRを取り込んだだけで、関連Issueや外部PRのProject Statusを「完了」にしません。PR自体のStatusは管理者がProject画面で管理し、進捗は関連Issueで追跡します。分類ラベル「外部提案」は保持します。

共有stagingのE2Eは管理者が実行します。外部PRを提出しただけでは共有stagingへのデプロイや本番公開は起動しません。外部開発者が元サイトへ直接デプロイする必要はありません。

管理者向けの通知設定と受付確認は[外部提案の管理](docs/external-proposals.md)を参照してください。
