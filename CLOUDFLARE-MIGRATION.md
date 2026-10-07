# Cloudflareへの移行

このブランチは単独のCloudflareアカウント向けです。初回PRでmainもCloudflare版へ移行します。Sitesで公開中のサイトと既存データは変更しません。新しいD1・R2を空の状態から使い、Sitesからのインポートや最初のログイン者への所有者付与は行いません。

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

Googleのクライアントシークレットは、各WorkerのSettings → Variables and Secretsで、種類Secret・名前`GOOGLE_CLIENT_SECRET`として登録します。GitHubにはコピーしません。通常のWranglerデプロイでは登録済みSecretが保持されます。テスト環境については2026-09-28に利用者から登録完了の申告を受けています（実接続は未検証）。

## 3. GitHub Actionsを設定する

リポジトリSettings → Environmentsにstaging / productionを作ります。1人運用のため、productionのRequired reviewersは設定しません。公開の判断はPRのマージ時に行います。

各Environmentに以下を保存します。

Variables:
- CLOUDFLARE_ACCOUNT_ID
- D1_DATABASE_ID（環境ごとに別）
- APP_ORIGIN（Workerのhttps URL、末尾スラッシュなし）
- GOOGLE_CLIENT_ID
- PHOTO_STORAGE_GLOBAL_LIMIT_BYTES（任意、バイト単位。未設定時8000000000）
- PHOTO_STORAGE_USER_LIMIT_BYTES（任意、バイト単位。未設定時100000000）

Secrets:
- CLOUDFLARE_API_TOKEN（対象アカウントでWorkersのデプロイ、D1マイグレーション、R2バインディングの構成に必要な権限だけを付与）

### 日々の開発と本番公開（1人運用）

1. `cloudflare-migration`へpushするとstagingへ自動デプロイします。
2. stagingでGoogleログイン、ログアウト、写真投稿・閲覧、いいね等を実機確認します。
3. `cloudflare-migration`から`main`へPRを作成します。`PR checks`が型チェック・テスト・マージ結果のビルドと、PR先端コミットのstaging成功を確認します。
4. 動作を確認して、ご自身でPRをマージします。承認レビューは不要です。継続利用する開発ブランチなので、**Create a merge commit**を使用し、マージ後も`cloudflare-migration`を削除しません。
5. mainへのpushでproductionに自動デプロイします。本番コードはmainのコミットです。関連するマージ済みPRの先端コミットがstagingで成功済みかを確認してから、本番D1マイグレーション・デプロイ・未認証アクセス確認を実行します。
6. 次の開発前にmainを開発ブランチへ取り込みます（`git fetch github` → `git switch cloudflare-migration` → `git merge github/main`）。

stagingのデータを本番へコピーする処理はありません。PRチェックは実機確認の代わりにはなりません。mainへの直接pushは本番デプロイの検証で拒否します。

手動再実行はActions → Deploy Cloudflare → Run workflowを使えます。環境選択は廃止し、**Branch: mainは本番、cloudflare-migrationはstaging**に固定しました。ほかのブランチではデプロイしません。失敗した本番ジョブの再実行は同じコミットを使用します。

### GitHub側で設定するmainの保護

Settings → Branches → Add classic branch protection ruleでmainを対象にします（すでにルールがある場合は編集）。
- Require a pull request before merging: ON
- Require approvals: OFF（自分のPRを自分で承認できないため）
- Require status checks to pass before merging: ON、`PR checks`を指定（PRで一度実行してから選択）
- Require branches to be up to date before merging: ON
- Do not allow bypassing the above settings: ON（管理者も対象）
- Allow force pushes / Allow deletions: OFF

production EnvironmentのDeployment branches and tagsはSelected branches and tagsでmainのみ、stagingはcloudflare-migrationのみを許可します。GitHub側の設定はワークフローファイルの変更だけでは適用されません。

初回PRはSites版mainへCloudflare版全体を取り込むため、以後の機能PRより差分が大きくなります。この初回PRをマージすると上記の運用が有効になります。

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

写真は6枚/記録・8MiB/入力に加え、環境ごとに全体8,000,000,000バイト・ユーザー100,000,000バイトをサーバー側で制限します。既存画像の初期集計、上限変更、失敗時の回収は [PHOTO-STORAGE.md](PHOTO-STORAGE.md) を参照してください。staging・production・他バケットの合計やR2操作回数による課金を制限するものではありません。

参照:
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.google.com/identity/openid-connect/openid-connect
