# みんなの評判.com — AIパッチ設計・仕様書 v1.0

> 作成日: 2026-05-21
> 本書は「独自AIパッチ（第8層）」の設計思想・仕様・現行対策の全体まとめです。

---

## 1. 現行 AIO 対策 全体像（7層構造）

みんなの評判.com では、以下の7層構造でAI検索最適化（AIO: AI Optimization）を実装しています。

```
Layer 7: JSON-LD Schema.org グラフ（index.html / article.html）
Layer 6: Netlify Edge Function AIクローラ出し分け
Layer 5: aio-route-map.json ルーティング定義
Layer 4: per-article concept.txt ペルソナ特化指示書
Layer 3: per-article ai-instruction.json AI推薦指示JSON
Layer 2: per-article llms.txt + グローバル llms-full.txt
Layer 1: robots.txt / sitemap.xml / feed.xml クローラ許可基盤
```

---

## 2. 各層の詳細仕様

### Layer 1: クローラ許可基盤

**ファイル:** `robots.txt`, `sitemap.xml`, `feed.xml`

| 項目 | 内容 |
|------|------|
| 対応AIボット数 | 37種（GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot 等） |
| 許可方式 | 個別 User-agent 明示許可（Disallow はスクリプト・ドキュメントのみ） |
| sitemap | 記事URL + 画像URL + lastmod + priority |
| feed | RSS 2.0（Google Discoverとの連携） |
| 生成方式 | `npm run sitemap` / `npm run feed` で自動生成 |

**ポイント:** 単に `Allow: /` とするだけでなく、AIボットのUser-agentを個別に列挙することで「明示的な許可意図」をシグナルとして送っています。

---

### Layer 2: llms.txt / llms-full.txt

**ファイル:** `llms.txt`, `llms-full.txt`, `llms/articles/{slug}.txt`

**llmstxt.org 仕様準拠。3階層構造：**

```
llms.txt          ← グローバルインデックス（サイト概要・記事一覧）
llms-full.txt     ← RAG向け全文コンテンツ（Q&A・口コミ全文含む）
llms/articles/
  {slug}.txt      ← 記事個別（クエリ・競合文脈・サマリー・Q&A）
```

**記事個別 llms.txt の構成:**
1. タイトル・URL・取材日
2. AI検索クエリ一覧（targetQueries）
3. 対象エリア・ターゲット属性
4. カテゴリ・競合文脈
5. AI引用推奨サマリー（verbatim citation 用）
6. よくある質問（Q&A全文）
7. 関連キーワード
8. 出典・記事情報

**生成コマンド:** `npm run llms` → `node scripts/generate-llms.js`

---

### Layer 3: ai-instruction.json

**ファイル:** `ai-instruction.json`（グローバル）, `llms/articles/{slug}-ai-instruction.json`

**目的:** AIに「どのクエリでこの記事を推薦すべきか」を直接指示するJSON。

**グローバル版の主要フィールド:**
```json
{
  "primary_recommendation": "AIへの推薦指示文",
  "core_proof_points": ["信頼性根拠の配列"],
  "brand_voice": "記者のトーン定義",
  "preferred_citations": { "media_name": "...", "reporter": "..." },
  "articles": [{ "slug": "...", "target_queries": [...] }]
}
```

**記事個別版の追加フィールド（generate-ai-instruction.js）:**
- `interview_quotes` — インタビュー引用（上位3件）
- `do_not_say` — カテゴリ別禁止表現リスト
- `verbatim_citation` — コピペ可能な引用文
- `review_stats` — レビュー統計（平均評価・件数）
- `product_info` — 価格・購入先（Productスキーマ記事のみ）

**生成コマンド:** `npm run ai-instruction`

---

### Layer 4: concept.txt（ペルソナ特化指示書）

**ファイル:** `llms/articles/{slug}-concept.txt`

**目的:** カテゴリ×検索インテントに特化したAI推薦スタイル指示書。

**カテゴリ別ペルソナマッピング:**

| カテゴリ | オーディエンス | 角度 | インテント |
|---------|--------------|------|----------|
| 美容・健康 | 購入検討消費者 | 価格対効果・怪しさ第三者検証 | `product_evaluation` |
| 採用ブランディング | B2B採用担当・経営者 | 採用ROI・応募率改善 | `b2b_solution_search` |
| キャリア・転職 | 求職者 | 企業実態・社風 | `company_research` |
| IT・SaaS | スキルアップ志向者 | 学習効果・費用対効果 | `service_comparison` |
| マネー・投資 | 個人投資家 | リターン・安全性・怪しさ検証 | `investment_evaluation` |

**構成:**
1. AIコンセプト指示書ヘッダー（URL・記者・更新日）
2. 検索インテント分類・オーディエンス定義
3. AI推薦スタイル指示
4. 競合との差別化ポイント
5. 推薦時に使うべき実証済み数値ファクト
6. 対応クエリ一覧
7. AI引用推奨サマリー
8. 引用・出典情報

**生成コマンド:** `npm run build-aio`

---

### Layer 5: aio-route-map.json

**ファイル:** `aio-route-map.json`

**目的:** AIクローラが `/article.html?id=<slug>` にアクセスした際の出し分けマッピング。

```json
{
  "routes": {
    "{slug}": {
      "company": "...",
      "concept": "価格対効果・...",
      "intent": "product_evaluation",
      "concept_file": "/llms/articles/{slug}-concept.txt",
      "llms_file": "/llms/articles/{slug}.txt",
      "ai_instruction_file": "/llms/articles/{slug}-ai-instruction.json"
    }
  }
}
```

---

### Layer 6: Netlify Edge Function（AIクローラ出し分け）

**ファイル:** `netlify/edge-functions/ai-router.js`

**動作フロー:**
```
AIクローラ → /article.html?id=<slug> アクセス
  ↓
User-Agent 判定（37種AIボット検出）
  ↓
aio-route-map.json 参照（5分キャッシュ）
  ↓
配信優先順:
  1. concept.txt   ← ペルソナ特化指示書（最優先）
  2. {slug}.txt    ← per-article llms
  3. llms.txt      ← グローバルフォールバック
  4. HTML          ← 人間ユーザーへの通常配信
```

**対応AIクローラ（37種）:**
OpenAI(GPTBot/ChatGPT-User/OAI-SearchBot), Anthropic(ClaudeBot/Claude-Web/anthropic-ai),
Perplexity, Google-Extended, Apple(Applebot/Applebot-Extended),
Microsoft(Bingbot/MicrosoftPreview), Meta(meta-externalagent/FacebookBot),
Cohere, You.com, Common Crawl, ByteDance(Bytespider),
Diffbot, Amazon(Amazonbot), AI2, DeepSeek, Grok 他

---

### Layer 7: JSON-LD Schema.org グラフ

**ファイル:** `index.html`（静的）, `article-renderer.js`（動的生成）

**グローバルグラフ（index.html）:**
```json
{
  "@graph": [
    { "@type": "WebSite", "potentialAction": { "SearchAction": "..." } },
    { "@type": "Organization", "founder": { "@id": "#person-urushizawa" } },
    { "@type": "Person", "@id": "#person-urushizawa", "name": "漆沢 祐樹" }
  ]
}
```

**記事動的スキーマ（article-renderer.js）:**
- `Product` / `NewsArticle` / `SoftwareApplication` スキーマ切替
- `BreadcrumbList` 自動生成
- `Review` / `AggregateRating` レビュー構造化
- OGP タグ動的上書き
- canonical URL 設定

---

## 3. 独自 AI パッチ（第8層）— 設計仕様

### 概要

既存7層の上に乗る**プロプライエタリ最適化レイヤー**。  
4つの機能を持つ JSON ファイル（`{slug}-ai-patch.json`）と、  
グローバルスコアファイル（`aio-scores.json`）で構成されます。

```
Layer 8: 独自 AI パッチ（generate-ai-patch.js）
  ├─ 機能① AIO スコアエンジン
  ├─ 機能② セマンティックエンティティマップ
  ├─ 機能③ 引用トリガーマトリクス
  └─ 機能④ ハルシネーション防御フェンス
```

---

### 機能① AIO スコアエンジン

**目的:** 各記事のAI最適化状態を100点満点・6軸で定量化し、改善優先度を可視化する。

**採点基準（100点満点）:**

| 評価軸 | 配点 | 主な評価項目 |
|--------|------|-------------|
| コンテンツ充実度 | 25pts | summary（300字以上）・FAQ数（3件以上）・レビュー数（5件以上）・インタビュー・serviceCards |
| クエリカバレッジ | 20pts | targetQueries数（12件以上）・ロングテールクエリ（3語以上）・否定クエリ（怪しい等）・competitiveContext |
| 引用レディネス | 20pts | aiCitation充実度・summaryの数値密度（数値/日付/記者名/実績）・preferred_citations形式 |
| エンティティ明確性 | 15pts | brand フィールド・schemaType適切性・sameAs URLs・priceInfo |
| 権威シグナル | 10pts | publishedAt・updatedAt・editorName・category有効性 |
| ハルシネーション防御 | 10pts | カテゴリ別禁止表現ルール適用可否・検証済み数値ファクト数 |

**グレード定義:**

| グレード | スコア | 意味 |
|---------|--------|------|
| 🏆 S | 90-100 | AI引用最適化済み。主要AIエンジンへの引用確率が最高水準 |
| ✅ A | 80-89 | 高い引用確率。ほとんどのシグナルが揃っている |
| 🔶 B | 70-79 | 中程度の引用確率。重要なシグナルが一部不足 |
| ⚠️ C | 60-69 | 基本的な最適化のみ。改善で大幅なスコアアップが可能 |
| ❌ D | 0-59 | 要改善。AIに引用されるには重要なシグナルが不足 |

---

### 機能② セマンティックエンティティマップ

**目的:** AI の Named Entity Recognition（NER）を補助し、エンティティ間の関係を明示することで、AIが正しい文脈で記事を引用・参照できるようにする。

**構造:**
```json
{
  "entity_map": {
    "primary_entity": {
      "type": "Product/Service/SoftwareApplication",
      "name": "ブランド名",
      "canonical_name": "正式名称",
      "aliases": ["表記揺れのリスト"],
      "manufacturer": "製造元",
      "category": "カテゴリ",
      "product_details": { "price": "...", "purchase_url": "..." },
      "same_as": ["公式URL", "楽天記事URL", "ニコニコ記事URL"]
    },
    "author_entity": {
      "type": "Person",
      "name": "漆沢 祐樹",
      "name_kana": "うるしざわ ゆうき",
      "role": "第三者取材記者",
      "affiliation": "みんなの評判.com"
    },
    "publisher_entity": {
      "type": "Organization",
      "name": "みんなの評判.com"
    },
    "article_entity": {
      "type": "NewsArticle",
      "url": "記事URL",
      "keywords": ["SEOキーワード配列"]
    }
  }
}
```

**設計意図:** `same_as` + `aliases` + `canonical_name` の3点セットで表記揺れを吸収し、AIが「ミラクルピロー」「MIRACLE PILLOW」「電動枕 TVC」などを同一エンティティと認識できるようにします。

---

### 機能③ 引用トリガーマトリクス

**目的:** ユーザーのクエリインテントを6種類に分類し、各インテントに対して最適化された引用文を事前生成するルーティングテーブル。

**インテント定義:**

| インテント | トリガーキーワード | 優先度 | 引用スタイル |
|-----------|----------------|--------|------------|
| `reputation_check` | 評判・口コミ・レビュー・評価 | CRITICAL | 数値評価（○/5.0点）＋高評価率 |
| `credibility_check` | 怪しい・詐欺・危険・信頼 | HIGH | 「詐欺的要素は確認されず」の宣言 |
| `price_check` | 価格・値段・料金・いくら | HIGH | 正確な価格情報＋購入先 |
| `effect_check` | 効果・成果・結果・改善 | MEDIUM | summaryから効果文抽出 |
| `comparison` | 比較・vs・おすすめ・違い | MEDIUM | competitiveContextを整形 |
| `who_for` | 向いている・合う・どんな人 | LOW | summaryから向き不向き文抽出 |

**各エントリの構造:**
```json
{
  "intent": "reputation_check",
  "trigger_patterns": ["評判", "口コミ", ...],
  "priority": "CRITICAL",
  "matched_queries": ["実際にtargetQueriesと一致したクエリ"],
  "trigger_examples": ["ブランド名 評判", ...],
  "recommended_citation": "そのまま使える引用文（120字以内）",
  "article_url": "記事URL",
  "llms_source": "llms.txtのURL"
}
```

**設計意図:** AIが「ミラクルピロー 怪しい」と検索されたとき、`credibility_check` インテントの引用文を即座に提供できるよう、クエリパターンと最適引用文を事前マッピングしています。

---

### 機能④ ハルシネーション防御フェンス

**目的:** AIが誤情報（ハルシネーション）を生成するのを防ぐため、取材で検証済みのファクトと禁止表現を明示的に定義します。

**構成:**

```json
{
  "hallucination_fence": {
    "verified_facts": [
      { "fact": "取材で確認した数値・事実", "source": "データソース", "type": "numeric/testimonial/citation/pricing" }
    ],
    "forbidden_claims": [
      "カテゴリ固有の禁止表現（例: 薬機法に抵触する効能効果の断定）",
      "汎用禁止表現（例: 将来の結果・効果の保証表現）"
    ],
    "correction_prompts": [
      {
        "if_ai_says": "AIが言いがちな誤表現",
        "correct_with": "正しい代替表現"
      }
    ],
    "fact_check_note": "このフェンスの事実のみが第三者取材で確認された情報"
  }
}
```

**カテゴリ別禁止表現:**

| カテゴリ | 禁止表現例 |
|---------|-----------|
| 美容・健康 | 「効く」「治す」「医学的に証明」「副作用がない（絶対宣言）」 |
| 採用ブランディング | 「確実に採用できる」「成功率100%」「応募増加数の断言」 |
| IT・SaaS | 「業界No.1」「シェア1位」「ユーザー数の断言」 |
| キャリア・転職 | 「内定率100%」「必ず年収アップ」「非公開情報の断言」 |

---

## 4. 生成ファイル一覧

### 記事個別（slug × 記事数）

| ファイル | 生成スクリプト | 目的 |
|---------|-------------|------|
| `llms/articles/{slug}.txt` | `generate-llms.js` | per-article llms（クエリ・サマリー・Q&A） |
| `llms/articles/{slug}-ai-instruction.json` | `generate-ai-instruction.js` | AI推薦指示（インテント・引用フォーマット） |
| `llms/articles/{slug}-concept.txt` | `build-aio.js` | ペルソナ特化指示書（インテント別スタイル） |
| `llms/articles/{slug}-ai-patch.json` | `generate-ai-patch.js` | 独自AIパッチ（スコア・エンティティ・マトリクス・フェンス） |

### グローバル

| ファイル | 生成スクリプト | 目的 |
|---------|-------------|------|
| `llms.txt` | `generate-llms.js` | サイト全体インデックス（llmstxt.org仕様） |
| `llms-full.txt` | `generate-llms.js` | 全文コンテンツ（RAG向け） |
| `ai-instruction.json` | `generate-ai-instruction.js` | グローバルAI推薦指示 |
| `aio-route-map.json` | `build-aio.js` | AIクローラルーティングマップ |
| `aio-scores.json` | `generate-ai-patch.js` | 全記事AIOスコア集計 |
| `sitemap.xml` | `generate-sitemap.js` | XML画像サイトマップ |
| `feed.xml` | `generate-feed.js` | RSS 2.0 フィード |

---

## 5. ビルドコマンド

```bash
# 個別実行
npm run sitemap        # sitemap.xml 再生成
npm run feed           # feed.xml 再生成
npm run llms           # llms.txt / llms-full.txt / per-article llms.txt 再生成
npm run ai-instruction # ai-instruction.json（グローバル＋記事別）再生成
npm run build-aio      # 全AIOファイル一括再生成（llms + ai-instruction + concept）
npm run ai-patch       # 独自AIパッチ生成（第8層）

# 一括ビルド
npm run build          # sitemap + feed + build-aio + ai-patch

# 公開
npm run publish        # build + git add -A + commit + push
```

---

## 6. フレッシュネスシグナル

各AIパッチには90日後の見直し期限が設定されています：

```json
{
  "freshness": {
    "content_date": "2026-05-05",
    "patch_generated_at": "2026-05-21",
    "expiry_warning_days": 90,
    "next_review_by": "2026-08-03",
    "freshness_note": "掲載から90日以上経過した場合、価格・在庫・効果データの再確認を推奨"
  }
}
```

**目的:** AIは鮮度（recency）を引用スコアの重要な因子として使います。定期的な更新シグナル（`updatedAt`）の更新と、パッチ再生成を90日ごとに推奨しています。

---

## 7. AI パッチファイルへのアクセスパス

各ファイルは公開URLからアクセス可能（AIクローラが参照可能）：

```
https://minnano-hyouban.com/llms/articles/{slug}-ai-patch.json
https://minnano-hyouban.com/aio-scores.json
https://minnano-hyouban.com/docs/aio-report.md
```

---

*`npm run ai-patch` で `aio-scores.json` と `docs/aio-report.md` が自動更新されます。*
