# 議事録の取材項目 ↔ 記事データ（テンプレ）対応表

取材ヒアリングで集める情報と、`data/articles.js`（`article-template.json`）のフィールド・記事上のセクションの対応です。

| 議事録で欲しい情報 | 主なデータフィールド | 記事ページ上のセクション（目安） |
|--------------------|------------------------|-----------------------------------|
| **目次** | （自動）見出し構造 | ヒーロー以降の各 `section`（記事レンダラが生成） |
| **設立背景** | `storyText` の一部、または取材メモを `featureBoxes` に分割 | 創業ストーリー（10）、注目ポイント（03） |
| **会社紹介** | `heroSub`、`serviceCards`、`steps` | ヒーロー（リード）、サービス概要（08） |
| **代表プロフィール** | 企業側：`storyText` / `storyImg`／記者：`editorName` `editorTitle` `editorImg` | 記者紹介（02）、ストーリー（10） |
| **実際のお客様の声** | `reviews[]`、`interviews[]` | 口コミ（06）、インタビュー（05） |
| **ストーリー性** | `reporterNote`、`featureBoxes`、`journalistTake`、`storyText` | 記者コメント、注目、見解、ストーリー |
| **顧客イメージ（来てほしい人・強み・対象外）** | `serviceCards` + `faqs` で表現、または `featureBoxes` に要約 | サービス概要・FAQ で補完 |
| **クレームはありますか** | `cuttingQA`（企業への直撃）、`reviews`（ネガ含む）、`faqs` | 切り込みQ&A（07）、口コミ、FAQ |

### 補足

- **議事録の「商品／人物／想い／評判／遷移」** は、ヒーロー〜CTA までの流れで **商品＝serviceCards＋ギャラリー**、**人物＝代表・記者**、**想い＝story・journalistTake**、**評判＝reviews・score**、**遷移＝CTA（`officialUrl`）** に対応します。
- 管理画面 `admin.html` の入力項目は、上記フィールドを JSON 生成するための UI と対応しています（未入力はプレースホルダーまたは省略）。
