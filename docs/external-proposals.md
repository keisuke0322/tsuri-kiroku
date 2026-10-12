# 外部提案の受付と通知

## 判定と受付

新規IssueとPRの元の投稿者の権限をAPIで確認します。write・maintain・adminは内部、read・triage・noneは外部です。Bot型またはログイン名が `[bot]` で終わるアカウントは除外します。編集・再オープンした人では判定しません。権限取得失敗はActionsの失敗として扱います。

外部投稿には分類ラベル `外部提案` を付け、Project #7にIssue／PR自体を追加し、未設定のStatusだけを `外部提案` にします。既存Statusは再実行で巻き戻しません。分類ラベルは確認後も保持します。forkからのPRでも管理者本人は外部分類しません。外部PR本文のRefsは他Issueの状態更新に使いません。

## 受付一覧

[Project #7](https://github.com/users/keisuke0322/projects/7)で新しいTableビューを作り、名前を「外部提案受付」、フィルターを `status:外部提案` にして保存します。確認後はProject画面でStatusを「検討中」等へ進めてください。PRのStatusもProject画面で変更できます。

対応が進んだ外部投稿を含めた一覧には別ビューで `label:外部提案` を指定するか、[外部Issue・PR検索](https://github.com/keisuke0322/tsuri-kiroku/issues?q=label%3A%E5%A4%96%E9%83%A8%E6%8F%90%E6%A1%88)を利用してください。

## 通知設定と受信確認

1. リポジトリ右上の「Watch」→「Custom」で「Issues」と「Pull requests」を選択して保存します。
2. [GitHub通知設定](https://github.com/settings/notifications)でWatchingのWeb／メール通知を選択し、通知先メールアドレスを確認します。
3. 外部から新しいIssue／PRが投稿されたら、[通知一覧](https://github.com/notifications)と選択したメールの受信を確認します。投稿を開き、分類ラベルとProjectのStatusも確認します。

Watchは内部投稿も通知対象です。Statusやラベルの付与だけで通知を保証しません。通知設定は管理者アカウントで行い、メール受信は本人が確認してください。外部専用メール・Slack送信は追加していません。

## 有効化と復旧

cloudflare-migrationへのpushでProject初期設定ActionsがStatus選択肢・分類ラベル・操作用ラベルを作成します。既存選択肢のID・色・説明は保持します。イベント処理は既定ブランチmainの信頼済みコードを実行するため、mainへマージしてから新規投稿の自動受付が有効になります。

「Update Project from issue labels」と「Update Project Status for Issues and PRs」のActions結果を確認します。失敗時は権限・PROJECT_TOKEN・Project選択肢を確認して再実行してください。再実行は既存のProject項目を利用し、設定済みStatusを上書きしません。外部コードはSecrets付きで実行しません。

外部PRは `Contribution checks` の成功と管理者レビュー後、merge commitでcloudflare-migrationへ取り込んだ時点で閉じます。関連Issueは本番成功まで開いたまま追跡し、外部PRのProject Statusも取り込み時点では「完了」にしません。詳細は[貢献ガイド](../CONTRIBUTING.md#取り込みから本番公開まで)を参照してください。

Issueフォームはmainへのマージ後にNew issueで選べます。外部PR用CIは提出先cloudflare-migrationにワークフローが入った後、そのブランチ宛てのPRの作成・更新で動作します。fork投稿ではGitHubのActions実行承認が必要な場合があります。
