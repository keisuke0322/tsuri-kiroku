# 釣果ノート — Cloudflare版

Googleログインで釣果・プロフィール・写真・いいねを共有するアプリです。

容量管理・既存画像の初期集計・上限変更・障害復旧の手順は [PHOTO-STORAGE.md](PHOTO-STORAGE.md) を参照してください。

## サイトを開く

[本番サイトを開く](https://tsuri-kiroku-production.keisuke0322.workers.dev)

Googleアカウントでログインしてご利用ください。

## 技術構成と開発

- React / TypeScript / Vinext
- Cloudflare Workers / D1 / R2
- Google OpenID Connect、サーバー管理セッション
- 写真の自動圧縮（長辺1,600px・JPEG品質80%）
- 写真容量のサーバー制限（環境ごとに全体8GB・ユーザー100MB、処理中の予約も含む）
- 7日・30日の魚種ランキング、注目の釣果

移行・Google認証・環境作成・GitHub Actionsの設定は [CLOUDFLARE-MIGRATION.md](CLOUDFLARE-MIGRATION.md) を参照してください。

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm exec wrangler d1 migrations apply DB --local
corepack pnpm dev
```

検証: `corepack pnpm run typecheck` / `corepack pnpm test` / `corepack pnpm build`

Sitesの既存データは取り込みません。テスト・本番は別のWorker、D1、R2を使用します。移行ブランチのpushはstagingへ自動デプロイします。staging確認後にcloudflare-migrationからmainへPRを作成し、ご自身でマージするとmainのコードがproductionへ自動デプロイされます。
