# Storybook運用

目的は、機能追加時に既存の画面部品を再利用し、デザインを統一することです。

## 起動と確認

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm storybook
```

http://localhost:6006 を開きます。OAuthやDBの設定は不要です。
`corepack pnpm run build-storybook`は静的ファイルを`storybook-static/`に生成します。

公開先は[stagingの/storybook/](https://tsuri-kiroku-staging.keisuke0322.workers.dev/storybook/)のみです。
ログインなしで閲覧でき、架空の固定データを使用します。レシピの検索リンクは外部サイトを開きます。

## 部品を追加・変更する

1. 既存の共通部品・専用部品で実現できるかをカタログで確認する。
2. 本体の実装をimportする`stories/*.stories.tsx`を追加・更新する。部品のコピーを作らない。
3. Metaに一意の英数字の`id`と日本語の`title`を付ける。通常・未入力・エラー・無効など、対応する状態を用意する。
4. 用途・使い分けをDocsに記載する。操作イベントには`storybook/test`の`fn()`を使用する。状態変更はStory内で完結させ、API・DB・R2へ接続しない。
5. 実際の親要素・CSSクラスを再現し、PC・スマートフォン幅、フォーカス、キーボード操作、長い文言を確認する。
6. 型チェック・既存テスト・アプリとStorybookのビルドを実行する。新しい見た目の種類が必要な場合はPRに理由を書く。

共通の色・文字・角丸は`app/globals.css`を正とします。Story専用の配置は`.storybook/storybook.css`に記載します。
Storyをアプリの`@source`へ追加しないでください。Storybook側だけでStory用のTailwindクラスを生成します。
初回は使用中の共通部品と主要な専用部品が対象です。未使用部品・画面全体の再現・自動画像比較は対象外です。

## staging限定の配信

アプリとStorybookは独立したVite設定でビルドします。StorybookはVinext・CloudflareのViteプラグインを読み込みません。
PRのCIでは静的ビルドを検証しますが、公開は行いません。

デプロイ設定のWorker名と`APP_ENV`がともにstagingの場合のみ、アプリのビルド後にStorybookを作成し、
`dist/client/storybook/`へ配置します。それ以外のアプリビルドでは同ディレクトリを削除します。
環境判定には`NODE_ENV`を使いません。stagingもproductionも最適化されたビルドを使用するためです。

Cloudflareの`run_worker_first`で`/storybook`とその配下をWorkerへ通し、`APP_ENV=staging`以外では404を返します。
`/storybook`は`/storybook/`へリダイレクトし、StoryやDocsはクエリ付きURLで直接開けます。
未存在ファイルは404を返し、アプリのHTMLへフォールバックしません。
アプリの認証・APIの権限・DBには変更を加えません。

デプロイ後は`scripts/storybook-smoke.mjs`で、stagingのHTML・索引・参照JS/CSS・ライセンスと、productionの404を検証します。
本番公開は従来どおりユーザーによるPRの確認・マージ後に行います。

配布物のライセンスは`/storybook/third-party-licenses.txt`に含めます。
