# `_drafts` 入稿ガイド（AI構造化 → サイト反映）

このディレクトリには、記事の下書き（投稿原稿）として Markdown ファイルを配置します。

GitHub Actions が `_drafts/*.md` を検知し、`status: publish` のものだけを **AIで構造化**して `data/articles.js` に反映します（AIは文章の「最適なフォーマット化」を担当します。）

## 必須 front matter

```yaml
---
company: "企業・サービス名"
category: "キャリア・転職" | "美容・健康" | "語学・スキル" | "マネー・投資" | "ライフスタイル"
publishedAt: "YYYY-MM-DD"
officialUrl: "https://example.com" # CTA遷移先（未確定なら "#" でも可）
status: "publish" # publish のときだけ反映
---
```

## 本文（自然言語）

- あなたが手書きした「メインコンテンツ」をそのまま貼ってください。
- 具体的な根拠（料金・体験談・懸念点など）が含まれていると、`reviews / interviews / FAQ / cuttingQA` 等への分解が精度良くなります。

## ファイル例

`_drafts/sample-company.md`

```md
---
company: "〇〇サービス"
category: "キャリア・転職"
publishedAt: "2026-04-03"
officialUrl: "https://example.com"
status: "publish"
---

ここにメインコンテンツ（自然言語）を貼る
（実体験、良かった点、懸念点、比較視点など）
```

