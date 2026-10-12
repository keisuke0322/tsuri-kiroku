# Issue状態の自動管理

| 操作 | ラベル | 担当 |
| --- | --- | --- |
| Issue登録 | 検討中 | AI、Issue opened Actions |
| 開発着手 | 開発中 | AGENTS.mdに従うAI |
| stagingデプロイ・動作確認・E2E成功 | staging確認待ち | Deploy Cloudflareの後続ジョブ |
| main向けPR登録 | 本番反映待ち | AI、PRイベントActions |
| mainへマージ後productionデプロイ・動作確認成功 | 完了 | Deploy Cloudflareの後続ジョブ（Issueも閉じる） |

開発コミットとPR本文に独立した行で `Refs #123` を記載する。複数のIssueは `Refs #123, #124` と書く。単なる文章中の番号や別リポジトリへの参照は対象にしない。PR本文には本番反映する全Issueを記載する。`Closes`などはマージ時にIssueを閉じるため、新規PRでは使用しない（過去の記載は解析可能）。

stagingではmainとの差分コミットから対象を取得する。開いているリリースPRに既に記載されたIssueは本番反映待ちを維持する。追加開発したIssueはAIがstaging成功後に本番反映待ちへ更新する。productionではデプロイしたmainコミットに対応するマージ済みPRの本文だけを使用する。

状態変更では他の状態ラベルだけを外し、優先度や分類を保持する。必要な状態ラベルは自動作成する。閉じたIssueをstaging・PRイベントで戻さない。デプロイやテストが失敗した場合は状態を進めない。ラベル更新自体が失敗した場合はActionsの後続ジョブが失敗し、再実行で復旧できる。

この設定を含むPRがmainにマージされると、Issue作成・PRイベントのActionsが有効になる。開発ブランチへの反映時点からAIルールとstagingの後続ジョブは利用できる。新しいSecretsは不要（標準GITHUB_TOKENを使用）。既存のProject操作用ラベルとProjectフィールドには干渉しない。
