# Cloudflareへの移行

このブランチは単独のCloudflareアカウント向けです。Sites版mainと既存データは変更しません。新しいD1・R2を空の状態から使い、Sitesからのインポートや最初のログイン者への所有者付与は行いません。

## 構成

React / Vinext / Workers、D1(SQLite)、非公開R2、Google OpenID Connect。
Googleの署名・issuer・audience・有効期限・nonceを検証し、Googleのsubを利用者IDにします。認証ヘッダーの自己申告は受け付けません。セッションはHttpOnly/Secure/SameSite=Lax Cookie、有効期限30日、D1にはトークンのハッシュだけを保存します。ログアウトは同一オリジンPOSTで失効させます。

新規写真はブラウザーで長辺最大1,600px・JPEG品質80%へ圧縮します。元画像はアップロードしません。閲覧にもログインが必要です。

確認済みテスト環境（利用者から提供）:
- URL: https://tsuri-kiroku-staging.keisuke0322.workers.dev
- D1 Database ID: bd5eb98e-edc9-4c26-8d2b-f1fd8e825ba5
- GoogleのリダイレクトURI: https://tsuri-kiroku-staging.keisuke0322.workers.dev/api/auth/google/callback

## 1. テスト環境を作る

Cloudflareのダッシュボードで以下を作成します。まずstagingだけで構いません。

| リソース | テスト | 本番 |
| --- | --- | --- |
| Worker | tsuri-kiroku-staging | tsuri-kiroku-production |
| D1 | tsuri-kiroku-staging | tsuri-kiroku-production |
| R2 Standardバケット | tsuri-kiroku-photos-staging | tsuri-kiroku-photos-production |

- Workersは無料プランを使用。WorkerはHello Worldから作り、表示されるworkers.dev URLを控えます。GitHubとの自動連携は不要です（後述のActionsでデプロイ）。
- D1は空のDBのみ作成。Database IDを控えます。テーブルはdrizzle/のSQLをWranglerで適用します。
- R2は有効化に契約操作が必要です。無料枠を超えると課金され、無料上限で自動停止するサービスではありません。無料運用の希望だけを根拠に契約しないでください。請求条件を確認したうえで有効化します。
- R2のr2.dev公開アクセス・カスタムドメイン公開は無効のままにします。
- stagingとproductionに同じD1 ID・R2バケットを指定しないでください。

## 2. Google認証を設定する

Google Cloudプロジェクトtsuri-kirokuのGoogle Auth Platformで、Branding・Audienceを設定します。まずExternal / Testingとし、自分のGoogleアカウントをテストユーザーに追加します。

「Clients」でWebアプリケーションのOAuthクライアントを作り、実際のWorker URLに合わせて以下をAuthorized redirect URIsへ登録します。

`https://tsuri-kiroku-staging.<自分のサブドメイン>.workers.dev/api/auth/google/callback`

本番も別クライアントを作成し、productionのURLを登録する運用を推奨します。サーバーリダイレクト方式なのでJavaScript originsの登録は使用しません。要求範囲はopenid / profile / emailのみ。クライアントシークレットはチャット・ソース・通常の変数へ貼り付けません。

Testingのユーザー以外へ公開する前にGoogle側の公開設定・必要な審査や同意画面情報を確認してください。

## 3. GitHub Actionsを設定する

リポジトリSettings → Environmentsにstaging / productionを作ります。productionには利用可能ならRequired reviewersを設定します。リポジトリのプランによって保護機能は異なります。

各Environmentに以下を保存します。

Variables:
- CLOUDFLARE_ACCOUNT_ID
- D1_DATABASE_ID（環境ごとに別）
- APP_ORIGIN（Workerのhttps URL、末尾スラッシュなし）
- GOOGLE_CLIENT_ID

Secrets:
- GOOGLE_CLIENT_SECRET
- CLOUDFLARE_API_TOKEN（対象アカウントでWorkersのデプロイ、D1マイグレーション、R2バインディングの構成に必要な権限だけを付与）

Workflowは手動実行です。初回はworkflowファイルがGitHubのデフォルトブランチにある必要があります。移行ブランチのレビュー完了後にmainへ取り込んでから、Actions → Deploy Cloudflare → Run workflowでstagingを選びます。単にpushしただけでは公開しません。

実行順: 固定バージョンの依存パッケージ取得 → 型チェック・テスト → 環境設定 → ビルド → WorkerのSecret登録 → 対象DBのマイグレーション → デプロイ → 未ログイン画面・APIの確認。

stagingでGoogleログイン、ログアウト、写真投稿・閲覧、いいね、2アカウント間の権限を実機確認後、同じコミットでproductionを実行します。Workflowも同一コミットのstaging成功を確認します。これは手動の実機確認を代替しません。

## 4. ローカル検証

Node 24 / corepack pnpm。`.dev.vars.example`を`.dev.vars`へコピーし、ローカル用OAuth設定を入れます。Googleのredirect URIには`http://localhost:5173/api/auth/google/callback`を登録します。

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm exec wrangler d1 migrations apply DB --local
corepack pnpm dev
corepack pnpm run typecheck
corepack pnpm test
corepack pnpm build
```

wrangler.jsoncはローカル専用で、実際のリソースIDを含みません。公開にはscripts/cloudflare-config.mjsで生成したwrangler.deploy.jsonを使用します。GOOGLE_CLIENT_SECRETはWrangler Secretとして保持し、生成設定にもビルド引数にも含めません。

## DB変更と戻し方

schema変更時はdb/schema.tsを更新し、`corepack pnpm db:generate`で新しいSQLを追加・レビューします。適用済みSQLは編集しません。同じSQLをstaging、本番の順に適用します。テストDBの向き先を本番へ変えるのではなく、別々の環境に同じ変更をデプロイします。

DB変更はWorkerのロールバックでは戻りません。既存データがある変更の前はD1エクスポートやTime Travelを確認し、まず追加的な変更を優先します。破壊的変更はバックアップ・戻し方を決めてから行います。

## 運用と費用

Workers・D1・R2の無料枠はアカウント内の他用途とも共有されます。R2の超過課金と、GitHub Actionsの非公開リポジトリの利用枠は別です。常時無料を保証する設定ではありません。使用量をダッシュボードで確認し、一般公開前にアップロード量やアクセス頻度に応じた制限を検討します。

写真圧縮・既存の6枚/記録・8MB/入力制限はありますが、アカウント全体のR2課金上限を強制するものではありません。

参照:
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.google.com/identity/openid-connect/openid-connect
