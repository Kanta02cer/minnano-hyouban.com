# 企業別・記事別「商品・公式サイト」遷移の計測ガイド

評判記事から企業の公式サイト（商品ページ）へ読者がどれだけ遷移したかを把握するための考え方と、本プロジェクトでの実装・設定手順です。

---

## 1. 何を計測するか（目的の整理）

| 知りたいこと | 例 |
|--------------|-----|
| **どの記事**からクリックがあったか | 記事スラッグ（`slug`） |
| **どの企業**向け記事か | 企業名（`company`） |
| **どの種類の導線か** | 公式サイト主ボタン / 副リンク / メディア問い合わせ など |
| **遷移の回数（傾向）** | GA4 のイベント数・ユーザー数（※後述の限界あり） |

**注意**: ブラウザの広告ブロックやITPにより、**イベントが100%取れない**場合があります。厳密な請求根拠にする場合は、契約書で「推定値」である旨を明記するか、別途サーバ側計測を検討してください。

---

## 2. 本サイトで既に用意している仕組み（クライアント計測）

`article-renderer.js` では、記事レンダリング後に **CTAリンク**（`data-cta-kind` 付き）のクリックで次を送信します。

- **イベント名**: `article_cta_click`
- **パラメータ（想定）**:
  - `cta_kind` — 例: `article_official`（主ボタン）, `article_contact`, `article_media_inquiry`
  - `article_slug` — 記事ID（URLの `?id=` と同じ）
  - `company` — 企業・サービス名
  - `cta_source` — 例: `official_url` / `fallback_mailto`
  - `page_url` — クリック時の記事URL

**GA4 を有効にするには**、ページ上に **測定ID** を渡す必要があります（未設定だと `maybeInitGA4()` は何もしません）。

- **方法A**: `article.html` の `<head>` に  
  `<meta name="ga4-measurement-id" content="G-XXXXXXXXXX">` を置く  
- **方法B**: 読み込み前に  
  `window.__GA4_MEASUREMENT_ID__ = 'G-XXXXXXXXXX';` を設定する  

同意管理を厳密にする場合は、`localStorage` の `analytics_consent` が `'false'` のときイベントが送られない実装になっています（`article-renderer.js` 内）。

---

## 3. Google Analytics 4（GA4）での設定手順（推奨）

### 3.1 プロパティ・データストリーム

1. [Google Analytics](https://analytics.google.com/) でプロパティを作成（または既存を使用）。
2. **データストリーム** → **ウェブ** → サイトURL（例: `https://minnano-hyouban.com`）を登録。
3. **測定ID**（`G-` で始まる）をコピーし、上記 **2.** のとおり `article.html` に埋め込む。

### 3.2 カスタムイベントとして扱う

`article_cta_click` はカスタムイベントです。GA4 では通常、数日以内に **イベント** 一覧に現れます。

- **管理** → **データの表示** → **イベント** で `article_cta_click` を確認。
- **登録**して「コンバージョン」にしたい場合は、同画面から **コンバージョンとしてマーク**（任意）。

### 3.3 イベントパラメータをレポートで使う（重要）

GA4 では、イベントに付いたパラメータを分析で使うには **カスタム定義の登録** が必要な場合があります。

1. **管理** → **データの表示** → **カスタム定義** → **カスタム指標の作成**（またはディメンション）。
2. 例として次を **イベントスコープ** で登録:
   - `company`（企業名）
   - `article_slug`（記事スラッグ）
   - `cta_kind`（CTAの種類）
   - `cta_source`（公式URL由来かフォールバックか）

※ パラメータ名は実装と **完全一致** させる（`article_slug` など）。

登録後、**探索** レポートで「次元」に `company` や `article_slug` を置き、「指標」にイベント数を置くと、**企業別・記事別のクリック数**を集計できます。

### 3.4 レポートの見方（例）

- **レポート** → **エンゲージメント** → **イベント**: `article_cta_click` の発火数。
- **探索** → **自由形式**:  
  - 行: `company` または `article_slug`  
  - 値: イベント数  
  → 企業別・記事別の「公式遷移ボタン」クリックの分布。

---

## 4. 公式URLに UTM を付けて「流入元」を企業側アナリティクスでも見えるようにする

メディア側だけでなく、**企業の Google アナリティクス**でも「みんなの評判経由」と分かるようにする方法です。

### 4.1 データ側で `officialUrl` にクエリを付与

例（掲載記事の `officialUrl`）:

```text
https://example.com/service?utm_source=minnano-hyouban&utm_medium=referral&utm_campaign=review_article&utm_content=1794482170414453
```

- **`utm_source`**: 固定で `minnano-hyouban` などメディア名。
- **`utm_medium`**: `referral` または `pr`（社内ルールで統一）。
- **`utm_campaign`**: キャンペーン名（例: `review_2026`）。
- **`utm_content`**: **記事スラッグ**や企業コードを入れると、どの記事経由かを企業側で区別しやすい。

**注意**:

- 企業のURLがすでにクエリを持つ場合は `&` で連結する。
- 企業のサイト側でリダイレクト時に UTM が落ちる場合があるため、**必ずリンク先で確認**する。

### 4.2 自動付与（実装済み）

- `article-renderer.js` の `applyOfficialUtm` が、`resolveOfficialUrl` で正規化した **公式サイトURL** に `utm_*` をマージします（デフォルトは `utm_source=minnano-hyouban` / `utm_medium=referral` / `utm_campaign=review_article` / `utm_content=<記事スラッグ>`）。
- **無効化**: 記事ページで `article-renderer.js` 読み込み前に `window.__OFFICIAL_LINK_UTM__ = false;` を設定。
- **上書き**: 同様にオブジェクトで `utm_campaign` 等を渡すとデフォルトとマージされます。
- **プライバシーポリシー** 第8条に、計測用クエリ付与の旨を記載済みです。

---

## 5. 中継URL（リダイレクト）で計測する方式（上級）

**GitHub Pages はサーバ処理がない**ため、次のような構成になります。

1. **Cloudflare Workers / AWS Lambda@Edge** などで `https://minnano-hyouban.com/go?u=...&s=...` を受け、**1回ログ**してから `302` で公式へ飛ばす。
2. ログを **BigQuery / スプレッドシート** に蓄積すれば、広告ブロックに影響されにくい「クリック数」に近い数値が取れる。

コストと運用が増えるため、**まずは GA4 の `article_cta_click` + UTM** で足りるか判断するのが現実的です。

---

## 6. 法令・表示まわり（必ず確認）

- **ステルスマーケティング規制**: PR記事である旨の表示（既存の注記）を維持する。
- **プライバシーポリシー**: Google アナリティクス利用・Cookie・同意の説明を記載（GA4 利用時）。
- **企業との契約**: 「クリック数をKPIにする」場合、**計測方法（GA4・UTM・誤差）** を契約書または別紙で合意しておくとトラブルが減ります。

---

## 7. チェックリスト（運用開始時）

- [ ] GA4 の測定IDを `article.html`（または全ページ共通ヘッダ）に設置した。
- [ ] テスト環境で記事を開き、CTAをクリックし、GA4の **リアルタイム** で `article_cta_click` が見えることを確認した。
- [ ] `company` / `article_slug` / `cta_kind` を **カスタム定義** に登録した（探索で企業別集計できるようにした）。
- [ ] 必要なら `officialUrl` に **UTM** を付与し、企業側で流入が確認できた。
- [ ] プライバシーポリシーに **アクセス解析** の記述がある。

---

## 参考: 実装ファイル

- `article-renderer.js` — `trackEvent`, `maybeInitGA4`, CTA の `click` リスナー

質問や「UTM自動付与をコードに入れたい」場合は、その前提（付与ルール一覧）を決めてから実装に進むと安全です。
