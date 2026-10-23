# 2026-10-23 モバイル編集デザイン

本番URL: https://minnano-hyouban.com/

65記事とホーム・一覧・案内ページの表示を更新。保留中の11906とその依存資産は変更していません。本文、Q&A、引用、出典、構造化データ、検索用title、canonical、日付、同意付きGA4と公式CTAを維持しています。

- 正本は `site-v2/`。`mobile-editorial-20261023.css` と同名JSを通常ビルドで含めます。
- `npm run build:branch-root` で配信用distとGitミラーのルートを生成します。
- Facebook、X、LinkedIn、LINE、正規URLコピーを記事上部・下部へ追加しました。実際のSNS投稿はしていません。
- 99記事（姉妹媒体を含む）・297レスポンシブ表示と意味情報の保全を確認。両媒体の対象155公開ファイルのHTTPS/SHA-256一致を確認しました。
- GitHubは履歴ミラーです。実配信はXServerのため、pushだけを本番反映と扱わないでください。
- Google登録、AI引用数、GA4受信の変化は今回測定していません。

生成HTMLの末尾に空行があるためgit diff --checkは空行の注意を出しますが、公開済みハッシュとの一致を維持しています。
