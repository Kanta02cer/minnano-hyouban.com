# 編集記事の見出し・本文・デザインを更新する

2026-10-20、ユーザーが確認した編集記事デザインを全ページへ採用。11906は基準計測前の保留対象として、HTMLと旧CSS・JavaScriptを完全に維持する。全体改修の承認だけで個別保留を解除しない。

公開前の追加照合で、11906の既存公開HTMLにOrganization.address/urlが加わっていたことを確認した。本文と計測は変わっていない。`content/report-publication-holds.json` のSHA `f92e731a8f8c6f87715cb10249f895616b9b4fd8ace797b4ba3e02a26e70916b` を現物保全基準とし、生成器・検証器・ミラーを整合した。このAI情報の追加は今回のデザイン改修の実施内容ではない。旧適用前バックアップは残す。今回の公開では11906をアップロード対象にせず、現物一致を確認するguardとして扱う。

## 正本と変更範囲

- 記事固有の本文：`site-v2/reports/<id>/index.html`。既存の事実・出典・取材節・FAQ・関係開示を旧一括テンプレートで置き換えない。
- 読者向け見出し・対象名・導入・実際の更新日：`content/report-presentation.json`。
- 要約・まとめ・FAQ・取材原稿：従来の `content/` 内の正本を引き続き使う。
- 共通デザイン：`site-v2/brand-story.css` と `brand-story.js`。11906が使う `site.css`、`home-b.css`、`site.js` を一括変更しない。
- 写真は出典と人物を確認した素材を使う。新しいGNA出典リンクを追加した場合は、記事内の `media-analytics-config` と `data-mm-link` も登録する。

HTML `title` には記事の内容に沿って「口コミ」「評判」「実績」を残す。H1は対象名と編集見出しを組み合わせ、OG、Article.headline、WebPage、パンくず、一覧の表示と構造化データを一致させる。検索用の語をすべての表示見出しで反復しない。

## 文章の基準

冒頭では、その記事で伝える具体的な工夫や選択を一つ示す。前提・課題、選んだ方法、具体例、読者にとっての意味を、因果が追える順序でつなぐ。一段落一論点、2〜3文を基本に長短をつけ、同じ結びを反復しない。

見出しは企業・人物固有の行動や変化を表す。名詞の羅列や「〜として整理します」の反復を減らし、主語と動詞で伝える。魅力は具体的な対応・開発・選択で示す。数字・時点・条件・発表主体・計画の状態、口コミの限界や事業関係の開示は残す。

引用を作らず、実際の発言との対応がない一人称インタビュー形式へ変えない。提供取材記録、公開ニュース、当媒体の直接取材を区別する。代表者の説明を顧客評価・独立した検証結果に変えない。みんなの評判.comは事業・サービスの仕組みを主軸にし、社長の取材.comの人物中心の記事を複製しない。

これらは読者に見える本文とメタ情報の双方へ適用する。AIだけに見せる宣伝文は作らない。検索・AIによる引用の増加は、実測前には成果として報告しない。

## 更新手順

1. `AGENTS.md`、`NEWS_ARTICLE_WORKFLOW.md`、`SEARCH_CITATION.md`、`MEASUREMENT_WORKFLOW.md`、Git差分、実公開内容を確認する。新情報の採用は原資料と取材照合を行う。
2. 該当する個別HTMLと編集JSONをそろえる。本文の訂正はレビューした完全一致文字列の `textReplacements: [{"from": "旧文", "to": "新文"}]` として登録できる。`identity`、`heading`、`lead`、`modifiedDate` もその記事の実際の値にする。初回公開日・取材日・資料確認日は流用しない。
3. 外部のレビュー済み訂正JSONを読み込む場合は `python3 scripts/apply-brand-design.py --overrides /絶対パス/訂正.json`。HTML・要約・取材・FAQの完全一致文字列を同期する。原文不存在、保留IDへの指定は停止する。私的な原資料をこのJSONに含めない。
4. 要約や取材の正本を直接編集した場合は `node scripts/enhance-search-pages.js --id 記事ID` を実行する。複数記事は `--id` を繰り返す。既存の計測URL・リンク数が変わる場合は停止するため、根拠と台帳を照合して直す。旧一括生成器と引数なしのenhancerは保全のため停止する。
5. `python3 scripts/apply-brand-design.py` で全体の一覧を更新する。既存記事の本文を作り直す処理ではない。`--id 記事ID` は対象記事のみを更新し、共通ページは変更しない。
6. `node scripts/validate-public-v2.js`、`node scripts/test-report-interviews.js`、`npm run build:branch-root`、`node scripts/stage-branch-root.js --check` を実行する。npmが使えなければpackage scriptと同じ順序でNodeを直接実行する。計測検証を外して通さない。
7. PC・スマホ・埋め込み幅で、見出しの意味上の改行、本文、写真、FAQ、長い会社名、公式リンク、横並び文字の中心、同意UIを実表示で確認する。アニメーションの停止と検索・絞り込みも確認する。

新規記事では、個別原稿・presentation・要約・取材等の必要データ・計測configとマーカーを準備し、`scripts/build-public-v2.js` の `reportIds` へ登録する。対象指定のenhancerとapplyを実行して、一覧・サイトマップまで検証する。

## 公開と保全

公開はXServerへの既存の正式経路で行い、GitHubへのpushだけで完了とはしない。公開前後の実ドメインHTML・CSS/JS・写真・サイトマップのSHAとMIMEを読み戻す。11906は最新の照合済み現物を記録した `content/report-publication-holds.json` のSHA、既存の計測runtimeは適用前のSHAと一致することを確認する。記事の初回公開日、Article.about、出典、FAQ、関係開示、既存計測リンクを保全し、変更対象と復元方法をアカウントに依存しない場所に記録する。
