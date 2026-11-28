# API仕様の管理

API仕様の編集元は [`openapi/openapi.yaml`](../openapi/openapi.yaml) です。
Honoで既存のAPIを処理し、同じVinext / Cloudflare Worker内で公開します。
DBスキーマや認証方式は変更していません。

## 仕様を確認する

- staging: https://tsuri-kiroku-staging.keisuke0322.workers.dev/api/docs
- ローカル: http://localhost:5173/api/docs
- 仕様JSON: 同じ環境の `/api/openapi.json`

通常の画面でGoogleログインしてから開きます。Scalarで入出力やエラーを確認し、
同じ環境のAPIへリクエストできます。ブラウザのCookieを使用するため、
トークンの入力は不要です。更新・削除の試し打ちでは実際にその環境のデータが変わります。
stagingでは自分で作った確認用データを使ってください。

ドキュメントと仕様JSONは `APP_ENV=local` または `staging` の場合のみ有効です。
本番・未設定・未知の値では404、公開対象の環境でも未ログインの場合は401になります。
Scalarの表示用JavaScriptはバージョンを固定したjsDelivrのURLから読み込みます。
APIリクエストは外部プロキシを使わず、同一オリジンに送信します。

## APIを追加・変更する

1. OpenAPIのパス、`operationId`、入出力、認証要件、ステータスコードを編集します。
2. `corepack pnpm run api:generate` を実行します。
3. Honoの処理と画面を更新します。新しい操作は `server/handlers.ts` に登録します。
4. 型チェック、契約・回帰テスト、ビルド、stagingのE2Eを確認します。
5. OpenAPIと生成物を一緒にコミットします。

`lib/api/generated` は型、Fetch SDK、Valibotスキーマ、仕様JSON、操作一覧、
画面用アダプターの生成先です。手動編集しません。
生成ツールと依存関係はlockfileで固定します。生成にアカウントや有料サービスは不要です。

```sh
corepack pnpm run api:generate
corepack pnpm run api:check
corepack pnpm run typecheck
corepack pnpm test
corepack pnpm build
```

`api:check` は再生成して差分を検出します。古い生成物や欠落がある場合は失敗し、
ローカルでは更新された生成物を残すため、その差分を確認してコミットできます。
CIでも同じ検査を行います。

## 検証と互換性

JSON入力は認証・必要な所有権確認の後、生成したValibotスキーマで検証します。
写真は既存の容量・所有権確認後にmultipartを読み込みます。
生成器のbinary検証が文字列用になるため、写真のフィールドだけは実際のFile用に
適合させ、実バイトの形式・容量検証も従来どおり行います。

釣果の基本制約はOpenAPIから生成したスキーマを画面とサーバーで共用します。
旧形式の `species/count/length`、数値文字列、空欄、前後の空白はアダプターで正規化します。
実在日、魚種の重複、所有権、写真割当、DBの状態などの業務検証は実装側に残します。

Honoの操作一覧はOpenAPIから生成し、操作ごとの実装登録を型チェックで照合します。
契約テストは実際のHono入口を通して、応答ステータス・Content-Type・JSONの形式を
確認します。本番での全レスポンスの再検証は行いません。
