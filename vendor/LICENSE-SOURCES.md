# 補足ライセンスの出典

以下のnpm配布パッケージにはライセンス全文が含まれていないため、公式リポジトリから取得した全文を保存しています。初期の3件は2026-10-14に確認し、@vitejs/plugin-rsc 0.5.38は2026-10-24に追加確認しました。バージョン変更時には再確認してください。ビルド処理は確認済みのバージョンに限り、この全文を補足として使用します。

| パッケージ | バージョン | 保存ファイル | 公式の出典 |
| --- | --- | --- | --- |
| @vitejs/plugin-rsc | 0.5.26 | vite-plugin-rsc.LICENSE | https://github.com/vitejs/vite-plugin-react/blob/main/LICENSE |
| @vitejs/plugin-rsc | 0.5.38 | vite-plugin-rsc.LICENSE | https://github.com/vitejs/vite-plugin-react/blob/2e8512f98a4fc1b302af760c9d41900c2fa66d0a/LICENSE |
| drizzle-orm | 0.45.2 | drizzle-orm.LICENSE | https://github.com/drizzle-team/drizzle-orm/blob/main/LICENSE |
| react-remove-scroll-bar | 2.3.8 | react-remove-scroll-bar.LICENSE | https://github.com/theKashey/react-remove-scroll-bar/blob/master/LICENSE |

0.5.38のnpmメタデータに記録されたgitHeadは `2e8512f98a4fc1b302af760c9d41900c2fa66d0a` です。このコミットのMITライセンス全文が保存済みの `vite-plugin-rsc.LICENSE` と一致することを確認しました。

## Storybook 10.6.7（2026-11-18確認）

- `storybook.LICENSE`はnpmのgitHead `fe4037caa4130753c27fe3e6dd73bda52550f68b`の[公式MITライセンス](https://github.com/storybookjs/storybook/blob/fe4037caa4130753c27fe3e6dd73bda52550f68b/LICENSE)です。`storybook`、`@storybook/react`、`@storybook/react-dom-shim`、`@storybook/addon-docs`の10.6.7に使用します。
- `storybook-bundled-licenses.txt`はプリビルド済みブラウザコードに含まれる依存とNunito Sansのライセンス全文です。managerとブラウザ用チャンクの`node_modules`ソースコメントからパッケージ名を抽出し、同コミットの[yarn.lock](https://github.com/storybookjs/storybook/blob/fe4037caa4130753c27fe3e6dd73bda52550f68b/yarn.lock)に記録された該当パッケージの全バージョンを含めています。実際には使われない版も含む保守的な一覧です。
- 各節にnpm配布物または公式リポジトリの出典を記録しています。gitHeadのない旧Radixパッケージは、同じモノレポの共有MITライセンスを補足しています。Nunito SansはGoogle FontsのOFL全文を含めています。
- 更新時はブラウザバンドル内の依存を再抽出してlockfileと照合し、配布物のLICENSE・NOTICE・COPYING全文（欠ける場合は公式出典）を再取得してください。`scripts/storybook-licenses.mjs`は確認済みの版以外では停止します。

`use-composed-ref@1.4.0`はnpm配布物・公式リポジトリともLICENSE全文がありません。公式`package.json`のMIT宣言を根拠に、SPDXの標準MIT全文とプロジェクト・npmメンテナの帰属表示を補足しています（著作権者・年は推測していません）。この出典と補足方法も配布する一覧に明記しています。
