# 依存更新の公開と開発ブランチへの同期

Issue #51。通常更新・緊急更新とも、現在の本番 `main` を基準にする。
開発途中の機能を更新PRへ混ぜず、管理者が更新PR・同期PRを手動マージする。

## 導入・有効化

**この変更がmainへ公開され、有効化確認が終わるまでは、従来のActionsで依存更新ブランチから本番公開できない。**
開発ブランチのstaging確認だけで新ルートの実運用が完了したとは扱わない。

1. この実装を通常の機能公開手順でstaging確認し、`cloudflare-migration → main` を公開する。
2. 既存のリポジトリSecret `PROJECT_TOKEN` の権限を確認する。Project用の権限に加え、このリポジトリのContents・Pull requests・Issues・Actions・Commit statusesの書き込み、Dependabot alertsの読み取りが必要。初回setupにはAdministrationの書き込み、Environmentsの書き込みも必要になる。アプリ版準備・同期PRはこのトークンで作り、通常のCIを起動する。`GITHUB_TOKEN` によるpushでは後続CIが起動しないため代用しない。トークンをログへ出さない。
3. 管理者がActions **Dependency governance** を `main`、`action=setup` で実行する。Dependabot alerts・security updatesを有効化し、「動作確認済み」ラベルを作成し、staging Environmentの既存cloudflare-migration許可を保持してmainのcontrollerを追加し、既存のmain専用Rulesetに `Contribution checks` と `Dependency release gate` を追加する。既存の `PR checks`・`Formatting`・厳密な最新base条件・直接push禁止・その他の規則を保持する。設定を読み戻した成功サマリーを確認する。権限不足・複数Ruleset等のエラーは未有効化として対処する。部分成功時も安全に再実行できる。
4. mainが既定ブランチであること、Settings → Code securityのDependabot alerts・security updates・Dependency graphが有効であること、main Rulesetの4チェックが必須であることを管理画面でも確認する。管理者バイパスを追加しない。DependabotがActionsで動く場合はリポジトリのActions実行許可も確認する。
5. `action=refresh` が成功し、開いているmain向けPRの `Dependency release gate` が表示されることを確認する。
6. Security → Dependabot / Insights → Dependency graph → Dependabotから **Check for updates** を開始する。更新ログにpnpm 11.25.0での解決・lockfile生成が成功していることと、更新PRのContribution checksを確認する。更新の採用・本番公開は下記手順で別途行う。

2026-10-22時点、[GitHubの2026-10-20告知](https://github.blog/changelog/2026-10-20-dependabot-now-supports-npm-12-pnpm-11-and-12-and-bun-1-4/)と[dependabot-coreのリリース](https://github.com/dependabot/dependabot-core/releases)でpnpm 11・11.25.0への対応を確認した。版固定は変更しない。プロジェクト固有のworkspace設定との互換性は実更新ログとfrozen-lockfileのCIで確認し、失敗時にpnpm版や保護を下げて回避しない。

## 通常更新

Dependabotは毎週土曜9:00（Asia/Tokyo）を目安にmain宛て更新PRを作る。通常PRの同時上限は5本（グループは1本）。セキュリティ更新はGitHubの別枠で、週次や通常の5本上限を待たない。

通常更新は公開から7日待つ。Dependabotのcooldownと既存のpnpm `minimumReleaseAge: 10080` を維持する。patch/minor/majorを検知し、React本体・DOM・RSC・型はpatch/minorとmajorを分けてグループ化する。WranglerとWorkers型のpatch/minorもまとめる。VinextのbetaやViteプラグインの0.xは個別に互換性を確認する。セキュリティ更新には通常更新のcooldownを適用しない。

1. 更新PRの差分・互換性・ライセンス（必要に応じて `vendor/LICENSE-SOURCES.md`）を確認する。
2. 管理者が **Dependency governance** をmain、`action=prepare`、`pr=番号` で実行する。最新の正式Releaseの次のPATCH版をpackage.jsonへ自動準備し、PR本文の `Release-Version` と `### DB変更・復旧` を整える。Dependabotの元の説明は保持する。既にReleaseより大きいアプリ版なら管理者の指定として保持する。必要に応じて管理者が番号・DB説明を変更する。
3. アプリ版のコミット後の **Contribution checks** 成功を待つ。PR作成・更新ごとに整形・型・テスト・ビルドが自動実行され、Secretsもデプロイ権限も渡さない。`PR checks` と公開ゲートがこの段階で未検証として失敗するのは正常。
4. 管理者が **Deploy Cloudflare** をmain、`action=validate-update`、`pr=番号` で実行する。最新mainを含む同一リポジトリの依存更新PRだけを受け付ける。許可する差分はpackage.jsonの依存・アプリ版、lockfile、既存override指定のバージョン、版限定の緊急待機例外、ライセンス補足だけ。scripts・packageManager・override対象指定・アプリ・ワークフロー等の変更は受け付けない。手動更新PRはprepareによる管理者の明示登録が必要。任意のブランチ名やラベルでは許可しない。
5. 選んだSHAのstagingデプロイ・起動確認・Cypress E2E・稼働版照合の成功を確認する。サマリー・[stagingの稼働情報](https://tsuri-kiroku-staging.keisuke0322.workers.dev/api/version)のSHA・runIdを照合する。mainのworkflow SHAと、実際にビルドした更新SHAは区別して記録される。
6. PC・スマートフォンで管理者が動作確認し、その後に更新PRへ **動作確認済み** ラベルを付ける。GitHubのラベル監査イベントの管理者・日時・対象SHA・基準main・検証runを状態記録とPRコメントへ残す。一般ユーザーの操作、検証前のラベル、ラベルだけの存在は確認の代わりにならない。
7. **PR checks**・**Formatting**・**Contribution checks**・**Dependency release gate** の成功と差分を確認し、管理者が **Create a merge commit** でmainへマージする。自動マージ・mainへの直接push・squash/rebaseでの公開は行わない。
8. productionデプロイ・起動確認・稼働情報照合・Publish Releaseの成功を確認する。Release-Versionとアプリ版の一致、公開済みタグの再利用禁止、DB変更・復旧の記載など既存条件を維持する。実際の依存採用・公開は管理者が判断する。

headやmainが変わったら、古い確認を無効化する。mainを取り込み、必要ならprepareをやり直して、CI・staging・E2E・動作確認・ラベルを再実行する。公開済みになった番号を再利用しない。番号を変更した場合も全検証をやり直す。

Contribution checksは対象headの最新実行・最新attemptが完了して成功していることを要求する。GitHubがマージ後に実行の関連PR一覧を空にする場合に限り、マージ済みPRと同じhead SHA・ソースブランチ・同一リポジトリの実行であり、`pull_request`イベントの`.github/workflows/contribution-checks.yml`であることを照合する。未マージPR、別PRの関連付けが残る実行、情報欠落、API失敗はこの代替照合で許可しない。

公開処理そのものの修正が必要になった場合、古い失敗実行の再試行には修正コードが反映されない。更新PRの占有中は、管理者が下記の`abort-update`で開発用stagingへ復帰してから修正版を通常の開発ルートで検証する。中止は更新PRのマージやmainの変更を取り消さないが、占有と動作確認の記録は無効になる。修正版の公開にも未対応更新・脆弱性アラート・最新ソースのstaging成功など通常の公開条件を要求し、占有記録の手編集や公開チェックの省略で復旧しない。

## 共有stagingの占有と復帰

すべてのstaging書き込みと状態更新は `shared-staging` の非キャンセル型concurrencyを共有する。実行中のDB操作を中断せずに待つ。GitHubのconcurrencyには待機数の制限があり、待機ジョブが新しいジョブに置換される場合は再実行する。

更新検証開始時に `automation/dependency-state` ブランチの `.dependency-state.json` に占有を保存する。状態ブランチはソースではなく、main・開発ブランチを変更しない。更新PR番号・head・基準main・controller SHA・検証run・Cloudflare版・管理者確認を記録する。状態変更はfast-forward限定で、競合する古い書き込みは失敗する。このブランチの削除・手編集で占有を解除しない。

占有はジョブ終了後も続く。開発pushのデプロイは**未実施として失敗**し、別の更新PRも拒否される。CIだけの成功、検証失敗、ジョブ取消、PR閉鎖、本番失敗では勝手に解除しない。必要なら開発デプロイを再実行する。現在のstaging版は確認記録と公開直前にも照合する。

productionとReleaseの成功後、**Restore development staging after publication** が復帰用の別実行を起動する。復帰実行の **Deploy**・E2E・稼働版確認の成功まで確認する。復帰対象は最新の開発ブランチで、成功後にだけ占有を解除する。復帰開始のディスパッチ成功だけでは復帰成功と扱わない。

本番失敗時は占有と確認記録を保持したまま、元の本番実行を再試行できる。中止・復帰で記録を解除した後に同じ本番を再試行する場合、現在のmainのマージ済み更新PRを指定してvalidate-updateをやり直し、動作確認済みラベルを付け、必要ならDependency governanceのrefreshを実行してから本番を再試行する。mainが進んだ古いPRは復旧対象にしない。

中止時は管理者がDeploy Cloudflareをmain、`action=abort-update` で実行する。失敗時も `restoring` の占有を保持し、管理者は `abort-update` または `restore-development` を再実行する。自動の `restore-development` は占有PRの公開済みReleaseと一致するときだけ開始できる。別更新が占有したstagingを古い公開処理で解除しない。

新しいWorker・D1・R2は追加しない。stagingには開発側の互換マイグレーションが先に入っている場合がある。更新検証でDBを巻き戻さず、既存の互換性・E2Eで確認する。

## 緊急・手動更新

脆弱性の通知や障害情報を確認したら週次を待たず、Dependabotの **Check for updates**、または最新mainからの一時ブランチ・main宛ての手動更新PRで開始する。脆弱性情報にない不具合も同じルートを使う。

7日未満の版が必要ならPR本文に `Emergency-Reason: 対象と緊急採用の理由` を書き、`pnpm-workspace.yaml` に対象の**完全なpackage@versionだけ**を追加する。

```yaml
minimumReleaseAgeExclude:
  - 'affected-package@1.2.3'
```

`minimumReleaseAge` 自体、ワイルドカード、版範囲で制限を緩めない。修正版が推移依存の場合も必要な全対象を個別指定し、lockfileを再生成してCIで確認する。例外は後続の手動更新で不要になり次第除去する。prepare以降のCI・staging・管理者確認・公開条件を省略しない。通常更新のDependabot設定を緊急用に恒久変更しない。

## 未対応更新と30日の保留

機能公開PR `cloudflare-migration → main` は未対応のmain宛てDependabot PRが残っていると止まる。majorも対象。閉じたPRやマージ済みブランチの残存は止めない。更新PR自身・同期PRはこの判定で自分を止めない。

管理者がDependency governanceをmain、`action=defer`、`pr=番号`、`reason=新しい理由` で実行すると、対象head・理由・管理者・記録日時・30日後の期限を状態とPRコメントへ保存する。同じ理由の再送では延長できない。解除は `action=undefer`。ラベル・手書きコメントだけで保留にはならない。期限切れ・更新headの変更で無効になる。再保留には新しい理由を入力し、改めて判断する。Dependabotの未解決アラートが1件でもある場合は、保守的にすべての保留例外を無効として再確認を求める。アラート取得の権限不足・API失敗は公開を止める。

PRイベント・CI完了・main更新・保留操作・毎時の定期処理で開いている機能公開PRの公開ゲートを更新する。取得エラーを「更新なし」と扱わない。本番直前にも現在の未対応PR・期限・アラートを再取得し、以前の成功だけでは公開しない。占有中も機能公開を止める。

機能公開は最新mainの取り込みと、そのソースのstaging成功が必要。未同期の本番依存を古いlockfileで戻すことを防ぐ。通常の機能公開のルートは引き続き開発ブランチからだけ。

## 公開成功後の同期・後片付け

Publish Release後の **Sync published main to development** は最新の正式Releaseに埋め込まれた本番成功記録、タグのSHA、DeployとPublish Releaseの成功を検証する。live mainに未公開コミットが進んでも同期しない。

`automation/published-main → cloudflare-migration` の同期PRは1本にまとめ、次の公開成功時に最新の公開済みSHAへ更新する。mainや開発ブランチのreset・force push・自動マージはしない。競合解消で同期ブランチに開発変更が入っていても、それを保持して新しい公開済みコミットをmergeする。競合時はジョブを止め、管理者が同期PRで解消し、最新開発コードとのContribution checksと差分を確認して手動マージする。マージ後は通常の開発stagingデプロイ・E2Eが走る。

本番公開の対象PRは、closedのmain向けPR一覧からマージ済み・merge commit SHAが本番コミットと完全一致する1件を取得する。コミットに関連するPRを取得するAPIには依存しない。一覧取得失敗・一致なし・複数一致は公開を止め、直接pushや別コミットのPRを代用しない。

同期処理だけ失敗したら、Dependency governanceをmain、`action=sync` で再実行する。本番の再デプロイは不要。すでに開発へ取り込まれていればPRを新規作成しない。復帰処理だけの失敗は上記の復帰アクションで対処する。Releaseだけの失敗は元の公開実行の失敗ジョブだけを再実行し、公開済みタグを動かさない。

公開に取り込まれたDependabot由来・`dependabot/`配下のブランチだけを自動整理する。対象が公開済みコミットの祖先であり、ブランチ先端がマージ時から変わっていないことも確認する。手動の再整理は `action=cleanup`。main・cloudflare-migrationや未公開の更新ブランチは削除しない。

## 通知・実運用の確認

管理者本人がリポジトリのWatch → CustomのPull requests・Security alertsを購読し、GitHub Settings → NotificationsのWeb・Email・送信先・セキュリティ通知を確認する。実際の通常更新PRとDependabot alertの通知をGitHub通知欄・メールの両方で受信確認する。通知先の本人設定をActionsの成功で代替しない。

初回有効化では通常patch/minor・major・関連依存・lockfileのみ・緊急例外を確認し、更新中の開発push、別更新の開始拒否、head/main変更時の無効化、失敗・中止・復帰の再試行を確認する。公開済みSHAだけの同期、同一PRの更新、競合、期限付き保留の境界・アラート・API権限失敗も確認する。新ルートの実更新・管理者のPC/スマートフォン確認・通知受信・本番公開は、実施した証拠を残すまで未検証として扱う。
