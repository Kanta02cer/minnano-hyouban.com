# AIO効果計測ガイド — みんなの評判.com

作成日: 2026-05-21  
対象: マーケター・経営者・サイト運営者

---

## 1. なぜ効果計測が難しいか

AI検索（ChatGPT・Perplexity・Gemini等）は「ゼロクリック」が基本設計です。ユーザーがAIに質問すると、AIが答えを直接生成して回答するため、ユーザーは元のサイトをクリックしない。この構造が、従来のGoogle検索最適化（SEO）の計測手法を根本から無効化します。

**従来SEO vs AIOの計測上の違い：**

| 項目 | 従来SEO | AIO |
|------|---------|-----|
| 効果の現れ方 | クリック・セッション増加 | 引用・認知向上（クリックなし） |
| 計測ツール | GA4・Search Console | 手動確認が主力 |
| 計測の即時性 | リアルタイム | 週次〜月次で傾向把握 |
| 因果の明確さ | 比較的明確 | 間接効果が多く曖昧 |

完全な計測は現状難しいのが実情です。しかし「AI引用の有無」「AIクローラーのアクセス数」「指名検索の増減」を組み合わせることで、AIO施策の効果を近似的に把握できます。

---

## 2. 計測すべきKPI 5つ

### KPI 1: AI引用率（最重要）

特定クエリをAI検索エンジンに入力し、自社コンテンツが引用・言及されているかを確認します。計測対象エンジンは以下の5つ。

- **ChatGPT**（GPT-4o / Deep Research モード）
- **Perplexity AI**（出典付き回答が確認しやすい）
- **Google AI Overview**（旧SGE、日本語クエリで表示）
- **Gemini**（Google製、AI Overviewと連動）
- **Claude**（Anthropic製）

### KPI 2: AIクローラーアクセス数

Netlifyのアクセスログで、主要AIボットがサイトをクロールしているかを確認します。クロールされないとAIの学習・引用候補に入らないため、最低限の前提条件です。

主な対象ボット: `GPTBot` / `ClaudeBot` / `PerplexityBot` / `Google-Extended` / `Applebot`

### KPI 3: 指名検索インプレッション（Search Console）

AIが回答した後、ユーザーが詳細を調べるために指名検索する「2nd search（セカンドサーチ）」効果を計測します。AI検索経由の認知が高まると、「ブランド名 評判」「ブランド名 怪しい」などの指名クエリのインプレッションが増加します。

### KPI 4: ダイレクト・リファラーの変化（GA4）

AIが読んだユーザーが後日直接サイトを訪問する間接効果をGA4で追います。特にPerplexityは回答画面に出典リンクを表示するため、`perplexity.ai` からのリファラーが計測可能です。

### KPI 5: AIOスコア推移

本サイト独自のAIOスコア（現在平均92点/グレードS）を週次で記録し、コンテンツ品質の維持・改善を確認します。

---

## 3. 週次チェックリスト — 手動AI引用確認

毎週同じ曜日に以下を実施します（所要時間: 約30分）。

### 確認クエリ一覧

各AI検索エンジンで以下のクエリを検索し、自社サイトが引用・言及されているかを記録してください。

```
1. [ブランド名] 評判
2. [ブランド名] 怪しい
3. [ブランド名] 価格
4. [ブランド名] 効果
5. カテゴリ一般クエリ（例: 「電動枕おすすめ」「首こり 改善グッズ」）
```

### 確認手順

1. **Perplexity AI** (`perplexity.ai`) でクエリを入力
   - 回答文中に自社ドメインが出典として表示されているか確認
   - Sources（出典）欄にリンクが含まれているか確認

2. **ChatGPT** (`chatgpt.com`) でクエリを入力
   - GPT-4oモードで実施（Plus契約の場合はDeep Researchも追加確認）
   - ブランド名・サイト名が言及されているか確認

3. **Google AI Overview** (google.co.jp) でクエリを入力
   - 検索結果上部の「AIによる概要」に自社が含まれるか確認
   - モバイルで表示されやすいため、スマートフォンでも確認推奨

4. **Gemini** (`gemini.google.com`) で確認
5. **Claude** (`claude.ai`) で確認

### 記録フォーマット

```
日付: YYYY-MM-DD
クエリ: [入力クエリ]
エンジン: ChatGPT / Perplexity / AI Overview / Gemini / Claude
引用あり: YES / NO
引用箇所: （YES の場合、引用文をコピー）
```

---

## 4. GA4設定方法 — AIクローラー計測

GA4のデフォルト設定ではAIクローラーのアクセスは識別できません。以下のカスタム設定を追加してください。

### カスタムディメンション設定

GA4管理画面 > カスタム定義 > カスタムディメンション から以下を作成：

```
ディメンション名: ai_crawler_type
範囲: イベント
イベントパラメータ: ai_crawler_type
```

### GTMでのイベント送信設定（Google Tag Manager利用の場合）

```javascript
// カスタムHTMLタグに追加
(function() {
  var ua = navigator.userAgent;
  var crawlerType = '';

  if (ua.indexOf('GPTBot') !== -1) crawlerType = 'GPTBot';
  else if (ua.indexOf('ClaudeBot') !== -1) crawlerType = 'ClaudeBot';
  else if (ua.indexOf('PerplexityBot') !== -1) crawlerType = 'PerplexityBot';
  else if (ua.indexOf('Google-Extended') !== -1) crawlerType = 'Google-Extended';

  if (crawlerType) {
    gtag('event', 'ai_crawler_visit', {
      'ai_crawler_type': crawlerType
    });
  }
})();
```

### GA4で確認できる指標

- Perplexity.aiからのリファラーセッション数（参照元/メディア: `perplexity.ai / referral`）
- ダイレクト流入の月次推移
- AIクローラー訪問イベント数

---

## 5. Netlifyログ分析方法

NetlifyのFunctionログまたはアクセスログからAIボットのアクセスを抽出します。

### Netlify CLIを使ったログ確認

```bash
# Netlify CLIをインストール（未インストールの場合）
npm install -g netlify-cli

# ログをリアルタイム確認
netlify logs:function ai-router
```

### ローカルにダウンロードしたアクセスログの分析

```bash
# AIボット全アクセス数を集計
grep -E "GPTBot|ClaudeBot|PerplexityBot|Applebot|Google-Extended" access.log | wc -l

# ボット種別ごとのアクセス数
grep -oE "GPTBot|ClaudeBot|PerplexityBot|Applebot|Google-Extended" access.log | sort | uniq -c | sort -rn

# ai-patch.json へのアクセス数
grep "ai-patch.json" access.log | wc -l

# llms.txt へのアクセス数
grep "llms.txt" access.log | wc -l

# concept.txt へのアクセス数
grep "concept.txt" access.log | wc -l

# 期間指定（例: 2026年5月分）
grep "May/2026" access.log | grep -E "GPTBot|ClaudeBot|PerplexityBot" | wc -l
```

### ai-router.js経由リクエストの確認

本サイトではNetlify Edge Functionの `ai-router.js` がAIクローラーに最適化済みコンテンツを返します。Netlify管理画面の「Functions」タブで呼び出し回数を確認できます。

---

## 6. Search Console活用法 — 2nd search効果の計測

### 確認手順

1. Google Search Console (`search.google.com/search-console`) にログイン
2. 「検索パフォーマンス」>「検索結果」を選択
3. フィルター: 「クエリ」に `[ブランド名]` を含む条件を追加
4. 以下の指標を週次・月次で記録：

| 指標 | 記録する内容 |
|------|------------|
| インプレッション数 | 「ブランド名 評判」「ブランド名 怪しい」の合計 |
| 平均掲載順位 | 同上クエリの平均順位 |
| CTR | クリック率（AI引用後は順位が低くても直接指名するため変動する） |

### 分析のポイント

- **インプレッション増加 + CTR低下**: AIが回答を完結させているため、情報収集目的のユーザーはクリックしないが認知は高まっている状態（AIOが機能している可能性が高い）
- **インプレッション増加 + CTR維持**: 理想的な状態
- **インプレッション・CTRともに変化なし**: AIOの効果が未発現、または指名クエリが少ない

---

## 7. 月次スコアカード

以下のテンプレートに計測値を記録します。

```
計測期間: YYYY年MM月
記録者:
```

| KPI | 計測方法 | 基準値（初回計測時） | 今月実績 | 目標値 | 達成 |
|-----|---------|----------------|---------|--------|------|
| AI引用率 | 手動確認（5エンジン×5クエリ） | 0% | — | 3エンジン以上で引用 | |
| AIOスコア（平均） | `npm run ai-patch` | 92点 | — | S（90点以上）維持 | |
| AIクローラーPV | Netlifyログ | — | — | 月間50PV以上 | |
| llms.txt閲覧数 | Netlifyログ | — | — | 月間10回以上 | |
| ai-patch.json閲覧数 | Netlifyログ | — | — | 月間10回以上 | |
| 指名クエリインプレッション | Search Console | — | — | 前月比+20% | |
| Perplexity.aiリファラー | GA4 | 0 | — | 月間5セッション以上 | |
| ダイレクト流入 | GA4 | — | — | 前月比+10% | |

### AIOスコア確認コマンド

```bash
cd /path/to/project
npm run ai-patch
# → aio-scores.json に最新スコアが出力される
```

---

## 8. 効果判定の目安

以下の条件を満たす場合、「AIO導入効果あり」と判断できます。

### 効果あり（段階別）

**レベル1 — クローラー到達（最低限）**
- 月間AIクローラーアクセス: 10件以上
- llms.txtまたはai-patch.jsonへのアクセス: 月間5回以上

**レベル2 — 引用候補入り**
- 5エンジン中1エンジン以上で引用を確認
- AIOスコアB（75点）以上を全記事で維持

**レベル3 — 認知効果発現**
- 指名クエリのインプレッションが3ヶ月連続で前月比増加
- Perplexity.aiリファラーが月間1件以上発生

**レベル4 — ビジネス貢献**
- 5エンジン中3エンジン以上で定期的に引用
- 指名検索インプレッションが導入前比+30%以上
- AI経由と推測されるダイレクト流入の増加傾向

---

## 9. 効果が出ない場合のトラブルシュート

### よくある原因と対策

**原因1: AIクローラーがサイトをクロールしていない**
- 確認: Netlifyログでボットアクセスがゼロ
- 対策: `robots.txt` でAIボットのアクセスをブロックしていないか確認。`ai-router.js` がデプロイされているか確認。

```bash
# robots.txtの確認
curl https://yourdomain.com/robots.txt
# GPTBot, ClaudeBot が Disallow されていないことを確認
```

**原因2: llms.txtが機能していない**
- 確認: `curl https://yourdomain.com/llms.txt` でコンテンツが返るか確認
- 対策: Netlifyのリダイレクトルール、またはEdge Functionの設定を見直す

**原因3: AIOスコアが低い（B以下）**
- 確認: `npm run ai-patch` でスコアを確認
- 対策: スコアの低い項目（構造化データ・FAQの充実度・引用可能フレーズの有無）を改善

**原因4: コンテンツが薄い・引用に値しない**
- 確認: 各AI検索エンジンで同カテゴリの競合サイトが引用されているか確認
- 対策: 専門性・独自性・信頼性（E-E-A-T）を高めるコンテンツ追加。具体的な数値・事例・専門家監修などを付加する。

**原因5: 計測期間が短すぎる**
- AIの学習データ更新サイクルは数週間〜数ヶ月かかる場合がある
- 最低3ヶ月は継続して計測し、傾向を見る

**原因6: 指名クエリのインプレッションが増えない**
- ブランド認知自体が低い場合は、AIO以外の認知施策（SNS・広告）との組み合わせが必要
- AIOはあくまで「既存の認知を検索に転換する」補完施策として位置付ける

---

*本ガイドは2026年5月時点の仕様に基づいています。AI検索エンジンの仕様・クローラー名は随時変更されるため、定期的に最新情報を確認してください。*
