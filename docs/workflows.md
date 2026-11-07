# GitHub Actionsの使い方と全体フロー

このガイドは、運用を担当する8つのActionsについて、**何をすると起動し、どの場面で何をするか**を説明します。
現在の開発ブランチは `develop`、本番ブランチは `main` です。
stagingは、本番公開前に画面と動作を確認する環境です。

## まず全体を見る：8つすべてのつながり

四角の先頭の①〜⑧が、Actions画面の8つの名前に対応します。
矢印の文字は起動のきっかけです。同じ出来事から複数のworkflowが並行して動きます。
「終了時」は成功・失敗の両方を含みます。起動後に条件を確認するため、**起動しただけで公開・マージ・完了するわけではありません**。

```mermaid
flowchart TD
    issue[人：Issueを作成] -->|Issue作成| status[⑧ Update Project Status for Issues and PRs]
    pr[人またはBot：PRを作成・変更] -->|PR作成・再オープン・説明編集・ドラフト解除| status
    status --> project[ProjectのStatusを更新]
    label[人：Issueに操作用ラベルを付ける] -->|project:開発中・priority:高など| labels[⑦ Update Project from issue labels]
    labels --> project
    init[手動実行 または developで関連設定を更新] -->|初期設定・移行| labels

    weekly[毎週土曜 日本時間9時が目安] --> bot[④ Dependabot Updates]
    bot -->|更新があればmain宛てPR作成| pr
    pr -->|develop・main宛てPRの作成・追加コミットなど| ci[① Contribution checks]
    pr -->|main宛てPRの作成・更新・ラベル変更など| deploy[② Deploy Cloudflare]
    pr -->|main宛てPRの変更・クローズなど| gov[⑤ Dependency governance]
    periodic[毎時17分・手動実行] --> gov
    ci -->|終了時| gov
    ci -->|終了時：同一リポジトリのmainからのPRが処理対象| sync[③ Auto-merge published sync]

    devpush[developへのpush] --> deploy
    mainpush[人：公開PRをmainへマージ] -->|mainへのpush| deploy
    mainpush -->|mainへのpush| gov
    manual[人：手動で依存更新検証などを開始] --> deploy
    deploy -->|終了時・検証後のrefresh起動| gov
    deploy -->|本番公開・Release成功後の内部処理| syncpr[mainからdevelopへの同期PRを作成・再判定]
    syncpr --> pr
    sync -->|条件を満たせば同期PRをマージしdevelopへpush| devpush
    deploy -->|開発staging成功後の内部処理| project
    deploy -->|終了時| complete[⑥ Complete published Issues]
    sync -->|終了時| complete
    complete -->|本番公開・開発同期・最新開発staging確認がそろう| done[Projectを完了に変更し対象Issueを閉じる]
```

④はGitHub標準のDependabot機能で、設定は `.github/dependabot.yml` にあります。
ほかの7つは `.github/workflows/` のYAMLで定義されています。
⑤は公開条件を再評価する係です。⑤の成功だけでデプロイやmainへのマージを行うものではありません。
②の「同期PR作成」「進捗更新」は②の内部ジョブであり、別のworkflowではありません。

## 場面A：機能を開発して本番へ公開する

```mermaid
flowchart TD
    A[人：Issueを作成] -->|issues opened| B[⑧ Update Project Status for Issues and PRs]
    B --> C[内部の投稿は検討中・外部の投稿は外部提案]
    C --> D[人：project:開発中ラベルを付ける]
    D -->|issues labeled| E[⑦ Update Project from issue labels]
    E --> F[Projectを開発中に変更・操作用ラベルを削除]
    F --> G[人：develop宛てに開発PRを作成・更新]
    G -->|PR作成・追加コミットなど| H[① Contribution checks：整形・型・テスト・ビルド]
    H --> I[人：結果を確認してdevelopへ取り込む]
    I -->|developへのpush| J[② Deploy Cloudflare：staging反映・E2E・進捗更新]
    J --> K[人：PC・スマートフォンで確認]
    K --> L[人：developからmainへ公開PRを作成]
    L -->|PR作成など| M[① Contribution checks：コード検査]
    L -->|main宛てPRイベント| N[② Deploy Cloudflare：Formatting・PR checksのみ]
    L -->|main宛てPRイベント| O[⑤ Dependency governance：公開条件を再確認]
    L -->|PR作成・説明編集など| P[⑧ Update Project Status for Issues and PRs：参照Issueを本番反映待ちへ]
    M --> Q[人：必要なチェック・公開情報を確認しmainへマージ]
    N --> Q
    O --> Q
    Q -->|mainへのpush| R[② Deploy Cloudflare：本番公開・Release・開発同期の開始]
    R --> S[公開後のフローへ]
```

### 人が行うこと

1. Issueを作成し、着手時に `project:開発中` ラベルを付ける。
2. コードを検査し、developへの反映後にstagingを確認する。
3. 公開PR本文に対象Issueを独立した行で `Refs #123` と記載する。複数は `Refs #123, #124`。
4. [資材のバージョン管理](releases.md)に従い、`Release-Version: vMAJOR.MINOR.PATCH` と `### DB変更・復旧` を記載する。
5. 必須チェックを確認し、管理者が **Create a merge commit** でmainへマージする。developは削除しない。

main宛てPRで②が動いても、その実行は検査です。本番公開はmainへのマージによるpushがきっかけです。
⑤は通常の機能公開でも、未対応の依存更新や未同期mainなどの条件を確認します。

## 場面B：依存ライブラリを更新する

```mermaid
flowchart TD
    A[毎週土曜 日本時間9時が目安] --> B[④ Dependabot Updates：更新候補を確認]
    B -->|更新あり| C[main宛て更新PRを作成]
    C -->|PRイベント| D[① Contribution checks：コード検査]
    C -->|main宛てPRイベント| E[② Deploy Cloudflare：公開条件チェックのみ]
    C -->|main宛てPRイベント| F[⑤ Dependency governance：公開条件・次の操作を更新]
    D -->|終了時| F
    G[毎時17分・PRラベル変更など・手動refresh] --> F
    C --> H[人：差分を確認しmainからstart-updateを手動実行]
    H --> I[② Deploy Cloudflare：版の準備・CI待ち・共有stagingの検証]
    I -->|準備コミットがPRへ追加される| D
    I -->|終了時・refresh起動| F
    I --> J[人：成功結果と画面をPC・スマートフォンで確認]
    J --> K[人：更新PRに動作確認済みラベルを付ける]
    K -->|ラベル付与| F
    F --> L[人：必須チェック成功を確認しmainへ手動マージ]
    L -->|mainへのpush| M[② Deploy Cloudflare：本番公開・Release]
    M --> N[公開後の同期・staging復帰へ]
```

### 検証開始の操作

GitHubの **Actions → Deploy Cloudflare → Run workflow** で入力します。

| 入力       | 値                     |
| ---------- | ---------------------- |
| Branch     | `main`                 |
| action     | `start-update`         |
| pr         | 更新PR番号。例：`123`  |
| source_run | 通常の手動実行では空欄 |

成功後、PC・スマートフォンで確認して更新PRに **動作確認済み** ラベルを付けます。
`Formatting`・`PR checks`・`Contribution checks`・`Dependency release gate` の成功を確認し、人がmainへマージします。

更新PRのCI成功だけではstagingに反映しません。
更新検証中は共有stagingを占有するため、通常開発のデプロイが止まることがあります。
中止・失敗時は状態ブランチを編集せず、[依存更新の運用](dependency-updates.md)の復帰手順を使ってください。
セキュリティ更新は週次の通常更新とは別枠で扱われます。

## 場面C：公開後に開発へ同期し、Issueを完了する

通常開発と依存更新の両方が、このフローにつながります。

```mermaid
flowchart TD
    A[② Deploy Cloudflare：本番デプロイ・Release成功] --> B[②の内部ジョブ：mainからdevelopへの同期PRを作成・再判定]
    B -->|同期PR作成・更新| C[① Contribution checks：最新headと開発baseを検査・記録]
    C -->|終了時| D[③ Auto-merge published sync]
    D --> E{公開済みmain・最新CI成功・競合なしなどの条件を満たすか}
    E -->|はい| F[同期PRを自動マージ]
    E -->|いいえ| G[待機または失敗理由を確認・対処]
    F -->|developへのpush| H[② Deploy Cloudflare：開発stagingを検証]
    A -->|依存更新のstaging占有がある場合は復帰用実行を起動| R[② Deploy Cloudflare：restore-development]
    H -->|終了時| I[⑥ Complete published Issues]
    R -->|終了時| I
    D -->|終了時| I
    A -->|親workflowの終了時にも起動| I
    I --> J{公開・開発同期・最新開発staging成功・占有解除がそろったか}
    J -->|はい| K[参照IssueのProjectを完了にしIssueを閉じる]
    J -->|いいえ| L[今回は完了せず後続実行で再確認]
    H -->|終了時| V[⑤ Dependency governance：公開条件を再確認]
    R -->|終了時| V
```

②の内部ジョブも同期PRの自動マージを再判定するため、すでにCI成功済みならそこで同期が進む場合があります。
同期が不要な場合もあります。開発stagingの検証には、条件を満たした既存の検証記録を再利用する場合があります。
③の終了直後は開発stagingがまだ処理中のことがあるため、⑥が一度起動してもIssueは閉じません。
**mainへのマージ済み表示は、公開後の処理がすべて終わったことを意味しません。**

## 場面D：Issue・Projectの進捗を更新する

```mermaid
flowchart TD
    A[Issue作成] -->|issues opened| B[⑧ Update Project Status for Issues and PRs]
    P[PR作成・再オープン・説明編集・ドラフト解除] -->|pull_request_target| B
    B --> C[内部Issue：検討中／外部投稿：外部提案]
    B --> D[同一リポジトリのdevelopからmainへのPR：RefsのIssueを本番反映待ちへ]
    E[人：Issueにproject:開発中などを付ける] -->|issues labeled| F[⑦ Update Project from issue labels]
    F --> G[ProjectのStatus・優先度を更新して読み戻し確認]
    G --> H[処理済み操作用ラベルを削除]
    I[developでproject-update.ymlまたはproject-status.cjsを更新] -->|対象パスへのpush| F
    J[⑦を手動実行] --> F
    F -->|push・手動実行の場合| K[選択肢・ラベルの初期設定と旧ラベルの移行]
```

⑧は出来事から自動判断し、⑦は人が付けた操作用ラベルを指示として処理します。
⑦のラベル処理には書き込み権限が必要です。無関係なラベルでは更新処理はスキップされます。
PRへのラベル付与は `issues:labeled` ではないため、⑦で外部PRのStatusを操作せず、Project画面で変更してください。

| 操作用ラベル                                               | Projectへの反映    |
| ---------------------------------------------------------- | ------------------ |
| `project:外部提案` / `project:検討中` / `project:開発待ち` | 同名のStatusへ変更 |
| `project:開発中` / `project:staging確認待ち`               | 同名のStatusへ変更 |
| `project:本番反映待ち` / `project:完了`                    | 同名のStatusへ変更 |
| `priority:高` / `priority:中` / `priority:低`              | 優先度を変更       |

⑦で `project:完了` を付ける操作はProjectのフィールド変更です。公開完了を検証してIssueを閉じる⑥とは処理が異なります。
デプロイ失敗時にラベルで状態だけを先へ進めないでください。

## 起動条件の早見表

PRの「更新」はイベントによって意味が異なります。追加コミットは `synchronize`、タイトル・本文などの編集は `edited` です。

| 番号・workflow                             | 自動起動の条件                                                                                                                                            | 手動実行                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ① Contribution checks                      | develop・main宛てPRの `opened` / `synchronize` / `reopened` / `ready_for_review`                                                                          | Run workflowなし。既存実行の再実行は可能                                 |
| ② Deploy Cloudflare                        | develop・mainへのpush。main宛てPRの `opened` / `reopened` / `synchronize` / `edited` / `ready_for_review` / `labeled` / `unlabeled`                       | 可能。検証・復帰などは他の処理から自動で手動イベントを発行する場合もある |
| ③ Auto-merge published sync                | ①の終了。実処理は同一リポジトリのmainからのPRが対象                                                                                                       | mainから再確認可能                                                       |
| ④ Dependabot Updates                       | 毎週土曜9時（Asia/Tokyo）が目安。セキュリティ更新は別枠                                                                                                   | Dependabot画面のCheck for updates                                        |
| ⑤ Dependency governance                    | main宛てPRの `opened` / `synchronize` / `reopened` / `closed` / `edited` / `labeled` / `unlabeled` / `ready_for_review`。mainへのpush。①②の終了。毎時17分 | mainから実行                                                             |
| ⑥ Complete published Issues                | ②③の終了                                                                                                                                                  | 再確認可能                                                               |
| ⑦ Update Project from issue labels         | Issueへの対象ラベル付与。developで `.github/workflows/project-update.yml` または `scripts/project-status.cjs` を変更するpush                              | 初期設定・移行を実行                                                     |
| ⑧ Update Project Status for Issues and PRs | Issueの `opened`。PRの `opened` / `reopened` / `edited` / `ready_for_review`（宛先ブランチ制限なし）                                                      | Run workflowなし                                                         |

定期実行の時刻は予約上の目安で、GitHub側の混雑などにより遅れる場合があります。

## 手動実行の選び方

Actionsで対象workflowを選び、**Run workflow** からブランチと入力を指定します。
通常の開発はpushを使います。本番への手動デプロイ・再実行は管理者が意図して行ってください。

### ② Deploy Cloudflare

| action                | 使う場面                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| `start-update`        | mainから更新PR番号を指定。準備・CI待ち・staging検証をまとめて実行（手動実行の既定値） |
| `validate-update`     | 依存更新の再検証。復旧条件は依存更新ガイドを参照                                      |
| `abort-update`        | 更新検証を中止し開発用stagingへ戻す                                                   |
| `restore-development` | 開発用stagingの復帰・再試行                                                           |
| `development`         | developなら開発staging、mainなら本番デプロイ                                          |

**Branchをmain、actionをdevelopmentにすると本番の処理対象です。**

### ⑤ Dependency governance

mainから実行します。`refresh` 以外は管理者権限が必要です。

| action    | 使う場面・入力                                               |
| --------- | ------------------------------------------------------------ |
| `refresh` | 公開条件と次の操作を再確認する。通常の再確認はこれを使う     |
| `setup`   | 導入時の設定。前提権限と確認項目は依存更新ガイドを参照       |
| `prepare` | `pr` を指定し更新の版などを準備。通常は②のstart-updateを使う |
| `defer`   | `pr` と `reason` を指定し、理由付きで30日間延期              |
| `undefer` | `pr` を指定し延期を解除                                      |
| `sync`    | 公開済みmainの開発同期と自動マージ条件を再判定               |
| `cleanup` | 公開済みの条件を満たすマージ済みDependabotブランチを整理     |

## 結果の見方・困ったとき

Actionsの対象実行を開き、**Summary → 各ジョブ → 失敗したステップのログ**を確認します。
成功はその実行が正常に終わったことを示します。待機・対象外でも成功やスキップになる場合があり、次の操作はSummaryとPRの案内で確認します。

| 状況                                        | 確認・操作                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| PRの検査が赤い                              | ①の失敗ログを確認し、修正をpush                                                            |
| staging・本番に反映されない                 | ②のDeployと占有・公開条件の案内を確認                                                      |
| PR checksは緑なのに依存更新をマージできない | ⑤が更新するDependency release gateと次の操作を確認                                         |
| 公開済み変更がdevelopに戻らない             | 同期PRの①、③のSummaryを確認。競合・開発base変更などは開発側で対処                          |
| 公開後もIssueが開いている                   | PRのRefs、Release、開発同期、最新開発staging、⑥の待機理由を確認。解決後は⑥を手動再確認可能 |
| 操作用ラベルが消えた                        | ⑦の正常処理。Project側の更新結果を確認                                                     |
| 本番Deploy成功・Release作成だけ失敗         | 原因解消後、失敗ジョブのみ再実行。本番再デプロイは不要                                     |

## 定義と詳しい運用手順

- [Contribution checks](../.github/workflows/contribution-checks.yml)
- [Deploy Cloudflare](../.github/workflows/cloudflare.yml)
- [Auto-merge published sync](../.github/workflows/published-sync.yml)
- [Dependabotの設定](../.github/dependabot.yml)
- [Dependency governance](../.github/workflows/dependency-governance.yml)
- [Complete published Issues](../.github/workflows/release-completion.yml)
- [Update Project from issue labels](../.github/workflows/project-update.yml)
- [Update Project Status for Issues and PRs](../.github/workflows/issue-status.yml)
- [依存更新の運用](dependency-updates.md)
- [Issueの状態管理](issue-status.md)
- [資材のバージョン管理](releases.md)
- [staging検証の再利用](staging-validation-reuse.md)
- [Cloudflare設定と公開手順](../CLOUDFLARE-MIGRATION.md)

## 状況表示専用：Track dependency progress

運用を担当する上記8つに加え、依存更新PRの案内コメントを更新する専用workflow。
PR更新・検証や公開処理の開始と終了・5分ごとの定期実行で、最新のPRと実行結果を読み直す。
デプロイの順番待ちとは別に動き、待機理由・次の操作・実行リンク・マージ後の公開とstaging復帰を表示する。
この処理自体はデプロイ、公開条件の緩和、確認済み記録の作成を行わない。
main反映後に有効になり、GitHubの実行待ちにより更新が遅れる場合がある。
