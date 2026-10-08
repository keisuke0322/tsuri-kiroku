# stagingのCypress E2E

`cloudflare-migration`へのpushで、型チェック・単体テスト・ビルド・stagingデプロイ・未認証アクセス確認の後に実行する。同じDeployジョブ内なので、E2Eが失敗するとstagingのデプロイ結果も失敗となり、既存のPR checksと本番公開ポリシーがそのコミットの公開を止める。Workerへの反映自体はE2E前に完了しており、自動ロールバックはしない。

ブランチ単位のconcurrencyをデプロイからE2E完了まで保持する。テスト中は共有stagingにワークフロー外の手動デプロイを行わない。productionでは実行しない。

## 初期設定

GitHub → Settings → Environments → staging → Environment secrets に設定する。

- `E2E_USER_ID`（必須）：依頼者本人の既存ユーザーID。stagingにGoogleログイン後、同じブラウザで `/api/profile` を開き、`userId`（`google:数字`）を確認する。値はIssue・チャットに貼らない。
- `E2E_OTHER_USER_ID`（任意）：別の既存GoogleユーザーID。一度stagingにログインしておく。未設定時は他ユーザーの編集・削除拒否をpendingとし、CIサマリーに未検証と記載する。
- 既存の `CLOUDFLARE_API_TOKEN`：staging D1へのクエリ実行にも使用する。

本人ID未設定やユーザー未登録はエラーとし、成功扱いにしない。設定後、Deploy Cloudflareを `cloudflare-migration` で再実行できる。

## 認証

ランナーはstagingの既存ユーザーに対してランダムな一時間有効のセッションをD1に作る。通常の認証と同じSHA-256ハッシュだけをDBに保存する。CypressのNodeタスク経由でHttpOnly Cookieを設定し、セッションをCypressのenv設定やコマンドログへ出力しない。GitHubログではトークンをマスクする。Googleパスワードや本番Cookieは使用せず、アプリに認証バイパスAPIを追加しない。

Google画面・OAuth往復はこのE2Eの対象外。既存の認証テストがトークン・nonce・state・PKCE・セッション期限等を確認する。E2Eの対象はstagingでの認証済み操作。「GoogleログインのE2E成功」とは報告しない。

## データと後片付け

- 各ケースは独立して釣果を作成する。編集・削除用の準備はAPI経由。
- ランナー生成の `E2E-UUID` をメモに保持し、画面操作には作成時のIDを使う。既存の釣果・プロフィールを変更しない。
- ケース終了後に作成したIDだけを削除する。ランナーのfinallyでも本人のowner_idと今回のメモが一致する釣果だけ検索し、通常の削除APIで写真を含めて後片付けする。
- 最後に今回発行したセッションだけを削除する。後片付け失敗はCI失敗とする。
- 強制終了・CIタイムアウトではfinallyが動かない場合がある。セッションは一時間で失効する。データが残った場合、ログの実行マーカーと所有者を両方確認して対象だけ削除する。一括削除は行わない。

## 対象ケース

認証済み一覧、登録と再読み込み後の永続化、必須入力と修正後の保存、編集の永続化、削除の永続化、スマートフォン幅の登録。別ユーザー設定時は公開釣果の閲覧・編集削除ボタン非表示・APIのPUT/DELETE拒否を確認する。現在の釣果はログインユーザー間で公開されるため、他ユーザーの閲覧拒否は要求しない。

写真アップロード・日付選択・検索のE2Eは今後の追加対象。入力境界値と認証・権限制御の細部は既存の単体・APIテストでも確認する。

失敗時はスクリーンショットを7日間保存する。動画は無効。スクリーンショットには画面上の釣果・表示名が写る場合がある。

## 実行と開発

CIは依存インストール後に `corepack pnpm exec cypress install` を明示実行する。pnpmの依存ビルドではブラウザをダウンロードしない。

staging用の `wrangler.deploy.json` と認証情報が準備された環境では `corepack pnpm run e2e:staging` で実行する。Worker名・origin・D1の名前とIDをstagingに限定し、productionへの接続を拒否する。

機能開発時はIssueの期待結果と既存テストから必要な追加・修正を判断し、人がレビューする。AGENTS.mdは作業ルールであり、push時にAIを起動する仕組みではない。
