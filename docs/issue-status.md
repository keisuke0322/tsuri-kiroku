# GitHub ProjectのStatus自動管理

状態は [Project #7](https://github.com/users/keisuke0322/projects/7) の `Status` フィールドで管理する。

| 操作                                           | Project Status  | 担当                                           |
| ---------------------------------------------- | --------------- | ---------------------------------------------- |
| Issue登録                                      | 検討中          | Issue opened Actions、AIのproject:検討中操作   |
| 開発着手                                       | 開発中          | AIのproject:開発中操作                         |
| stagingデプロイ・動作確認・E2E成功             | staging確認待ち | Deploy Cloudflareの後続ジョブ                  |
| main向けPR登録                                 | 本番反映待ち    | PRイベントActions                              |
| mainへマージ後productionデプロイ・動作確認成功 | 完了            | Deploy Cloudflareの後続ジョブ（Issueも閉じる） |

IssueがProjectに未登録なら自動で追加する。Status以外のフィールドや分類ラベルには触れない。Issueの通常ラベルは状態管理に使わない。

## AIからの操作

`project:検討中` / `project:開発待ち` / `project:開発中` / `project:staging確認待ち` / `project:本番反映待ち` / `project:完了` はProject更新の操作用ラベル。既存の `priority:高` / `priority:中` / `priority:低` も利用できる。Actionsが対応するフィールドだけを変更し、読み戻し確認後に操作用ラベルを外す。更新に失敗した場合は操作用ラベルを残す。リポジトリへの書き込み権限があるユーザーの操作だけを受け付ける。

## デプロイと対象Issue

開発コミットとPR本文に独立した行で `Refs #123` を記載する。複数のIssueは `Refs #123, #124`。PR本文には本番反映する全Issueを記載する。`Closes`などはマージ時にIssueを閉じるため、新規PRでは使用しない（過去の記載は解析可能）。

stagingではmainとの差分コミットから対象を取得する。デプロイしたコミットと同じheadのmain向けPRが既にあれば、PRの対象Issueは `本番反映待ち` にする。productionではデプロイしたmainコミットに対応するマージ済みPRの本文だけを使用する。デプロイやテストが失敗した場合は状態を進めない。本番の完了はStatusを読み戻し確認した後にIssueを閉じる。

## 既存設定からの修正と有効化

既存の `PROJECT_TOKEN` を全Project更新ジョブで使用する。新しいSecretsは不要。Issue・PRイベントの変更は、この修正をmainにマージした後に有効になる。

開発ブランチへのpushで初期設定ジョブを実行する。既存Statusの選択肢（開発待ちを含む）のID・色・説明を保持し、不足する5段階の選択肢だけを追加する。通常のIssue状態ラベルが付いたIssueはその値をProject Statusへ移し、読み戻し確認後に該当Issueラベルを外す。Issueを勝手に閉じたり再オープンしたりしない。状態ラベルが複数あれば推測せずジョブを失敗させる。

## 外部Issue・PR

外部投稿の初期Statusは `外部提案` です。同名の分類ラベルは出所を表し、Status変更後も保持します。通常ラベルで進捗を管理するものではありません。判定・通知設定・受付ビュー・有効化は[外部提案の管理](external-proposals.md)を参照してください。
