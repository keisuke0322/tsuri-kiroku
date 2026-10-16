# つりめぐり（TSURIMEGURI）

釣行・釣果を記録し、写真とともに共有できるWebアプリです。Googleアカウントでログインして利用します。

**[本番サイトを開く](https://tsuri-kiroku-production.keisuke0322.workers.dev)** · **[要望・不具合を報告する](https://github.com/keisuke0322/tsuri-kiroku/issues)** · **[開発に貢献する](CONTRIBUTING.md)**

## 主な機能

- **釣行の記録**：釣行日・場所・複数の魚種・匹数・サイズ・釣り方・メモを登録、編集、削除。
- **写真の共有**：1回の釣行に最大6枚を登録。写真と釣果の詳細をダイアログで確認。
- **釣果を探す**：7日・30日の魚種ランキング、注目の釣果、いいね。
- **釣果マップ**：自分の釣行を魚種・期間・お気に入りで絞り込み、過去の釣り場を再利用。
- **場所の公開設定**：「エリアのみ公開」「正確な位置も公開」「場所を非公開」から選択。
- **レシピ検索**：各魚種の料理アイコンから、楽天レシピ・クックパッドで「釣り＋魚名」を検索。
- **プロフィール**：表示名などのプロフィールを管理。

釣果・写真・メモはログインユーザー間で共有されます。登録内容を編集・削除できるのは本人です。自分の釣果マップ・釣り場マスタ・お気に入りは本人だけが利用できます。場所の公開設定の詳細は[釣果マップの仕様](docs/fishing-map.md)を参照してください。

## 要望・不具合報告

GitHubアカウントでログインし、[既存のIssue](https://github.com/keisuke0322/tsuri-kiroku/issues)を確認してから「New issue」で「機能要望」または「不具合報告」のフォームを選び、投稿してください。**要望や不具合の報告だけなら、forkやコード変更は不要です。**

- 要望：困っていること、希望する動作、利用場面。
- 不具合：再現手順、期待する動作、実際の動作、端末・ブラウザ。

投稿時の案内とコードを提案する手順は[CONTRIBUTING.md](CONTRIBUTING.md)にまとめています。

## 開発に貢献する

基本の流れは **fork → 作業ブランチで開発 → 自分のforkへpush → 元リポジトリへPR** です。

**開発のベースと外部PRの提出先は `cloudflare-migration` です。** 元リポジトリの `main` は本番用です。fork先へのpushだけでは、このサイトや元リポジトリへ変更は反映されません。

[貢献ガイド](CONTRIBUTING.md#forkからprを提出する)に、fork・clone・upstream登録・作業ブランチ作成・検証・PR提出のコマンドを記載しています。

## 技術構成

| 用途           | 技術                                                     |
| -------------- | -------------------------------------------------------- |
| 画面・アプリ   | React、TypeScript、Next.js（App Router）、Vinext（Vite） |
| 実行環境       | Cloudflare Workers                                       |
| データベース   | Cloudflare D1（SQLite）、Drizzle                         |
| 写真保存       | Cloudflare R2                                            |
| 認証           | Google OpenID Connect、サーバー管理セッション            |
| 地図           | Google Maps JavaScript API、Geocoding API                |
| 検証・デプロイ | Node.jsテスト、Cypress、GitHub Actions                   |

## ローカルで開発する

### 必要なもの

- **Node.js 24**：GitHub Actionsと同じバージョンを推奨します。
- **Corepack**：`corepack pnpm` を使用します。pnpmのバージョンは `package.json` で指定しています。
- ログインを確認する場合は、自分で用意したGoogle OAuthクライアント。
- Google地図の描画・場所名検索を確認する場合は、ローカル用Google Maps APIキー（任意）。

fork・cloneの手順は[貢献ガイド](CONTRIBUTING.md)を参照してください。以下はリポジトリのルートで実行します。

### 1. 依存関係とローカル設定を用意する

```sh
corepack pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
```

`.dev.vars` の `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` に、自分のローカル用OAuth設定を入力します。Google CloudでWebアプリケーション用のOAuthクライアントを作成し、リダイレクトURIとして次を登録してください。

```text
http://localhost:5173/api/auth/google/callback
```

Google側の設定がTestingの場合は、利用するGoogleアカウントをテストユーザーに追加します。[Google認証の設定](CLOUDFLARE-MIGRATION.md#2-google認証を設定する)も参照してください。

`.dev.vars` はGit管理対象外です。実際の設定値をコミットしないでください。元サイトの認証情報や本番・共有stagingのリソースは、ローカル開発には使用しません。

### 2. ローカルDBを初期化して起動する

```sh
corepack pnpm exec wrangler d1 migrations apply DB --local
corepack pnpm dev
```

**[http://localhost:5173](http://localhost:5173)** を開きます。OAuthのリダイレクトURIに合わせ、`127.0.0.1` ではなく `localhost` を使用してください。

`wrangler.jsonc` はローカル用です。D1・R2はローカルでエミュレートし、データはGit管理対象外の `.wrangler/` に保存します。上のマイグレーションは `--local` を指定するため、リモートDBには適用しません。スキーマ変更を取り込んだ後も同じコマンドで未適用分を適用できます。

### 設定なしで確認できる範囲

| 設定                    | 確認できること                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Google OAuthなし        | 型チェック・テスト・ビルド、未ログイン画面。ログイン後の操作にはOAuth設定が必要です。                                     |
| Google OAuthあり        | ローカルDB・R2を使った釣果登録、編集、削除、写真、いいねなど。                                                            |
| Google Maps APIキーなし | Google地図は「地図は準備中」と表示。GPS取得・座標の手動入力・過去の釣り場などは利用できます。                             |
| Google Maps APIキーあり | Google地図の描画、ピン操作、場所名検索。設定方法は[地図の設定](docs/fishing-map.md#google-mapsの設定)を参照してください。 |

### 3. 変更を検証する

```sh
corepack pnpm run typecheck
corepack pnpm test
corepack pnpm build
```

画面や機能を変更した場合は、関連するテストとPC・スマートフォンでの操作も確認してください。`e2e:staging` は管理者が共有stagingで実行するコマンドです。外部開発者向けのローカル検証には使用しません。

## ブランチと公開の流れ

| ブランチ・環境                        | 役割                                                   |
| ------------------------------------- | ------------------------------------------------------ |
| 外部開発者のforkの作業ブランチ        | 開発とPR提出。元サイトには自動デプロイされません。     |
| 元リポジトリの `cloudflare-migration` | 管理者が変更を取り込み、stagingへ自動デプロイ。        |
| 元リポジトリの `main`                 | 確認済みの公開PRをマージし、productionへ自動デプロイ。 |

管理者は外部PRをレビューし、開発ブランチへ取り込んでstagingを確認します。その後、`cloudflare-migration → main` のPRで公開します。stagingとproductionは別のWorkers・D1・R2を使用し、データは自動コピーしません。

運用・デプロイの詳細は[Cloudflare設定と公開手順](CLOUDFLARE-MIGRATION.md)を参照してください。

## ライセンス

本リポジトリのコードは [MIT License](LICENSE) で公開しています。著作権表示とライセンス全文を保持することで、商用利用・改変・再配布が可能です。ソフトウェアは無保証で提供されます。

外部ライブラリや第三者の素材には、それぞれのライセンスが適用されます。サイトに投稿された写真・釣果データは、このコードのライセンスによる利用許諾の対象ではありません。

ビルド時にブラウザ・サーバーへ組み込まれたライブラリのライセンス全文とNOTICEを収集し、配布物に `third-party-licenses.txt` を含めます。公開サイトの `/third-party-licenses.txt` で確認できます。必要な全文が見つからない場合はビルドを停止します。npm配布物に全文がない一部のパッケージは、[公式の出典と確認済みバージョン](vendor/LICENSE-SOURCES.md)を記録した補足ファイルを使用します。

## 関連ドキュメント

| ドキュメント                                        | 内容                                        |
| --------------------------------------------------- | ------------------------------------------- |
| [CONTRIBUTING.md](CONTRIBUTING.md)                  | 要望・不具合報告、forkからの開発・PR提出    |
| [Cloudflare設定と公開手順](CLOUDFLARE-MIGRATION.md) | 環境作成、Google認証、Actions、DB変更、公開 |
| [釣果マップ](docs/fishing-map.md)                   | 地図の設定、位置情報の公開範囲              |
| [写真ストレージ](PHOTO-STORAGE.md)                  | 容量管理、既存写真の集計、障害復旧          |
| [E2Eテスト](docs/e2e.md)                            | stagingでのCypress実行、認証、後片付け      |
| [外部提案の受付](docs/external-proposals.md)        | 管理者の通知設定、受付一覧                  |
| [Issueの状態管理](docs/issue-status.md)             | GitHub Project Statusの運用                 |
| [ブランド素材](docs/brand.md)                       | ロゴと使用方針                              |
| [AGENTS.md](AGENTS.md)                              | AIによる開発の作業ルール                    |
