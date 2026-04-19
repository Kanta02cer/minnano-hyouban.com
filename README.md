# みんなの評判.com

> 第三者記者・漆沢祐樹が企業の評判を直接取材するPR型評判メディア。

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [セットアップ](#2-セットアップ)
3. [記事の追加方法](#3-記事の追加方法)
4. [デプロイ手順](#4-デプロイ手順)
5. [ファイル構成](#5-ファイル構成)
6. [記事データの構造](#6-記事データの構造)
7. [よくある質問・トラブルシューティング](#7-よくある質問トラブルシューティング)

---

## 1. プロジェクト概要

### サイトの目的

フリーランス記者・漆沢祐樹が、企業からの取材依頼を受けて評判記事を執筆・掲載するメディアです。  
「PR記事であることを明示しつつ、第三者目線で正直に書く」というコンセプトのもと、良い評判も悪い評判も包み隠さずレポートします。

### 技術構成

| 項目 | 技術 |
|---|---|
| フロントエンド | 静的 HTML / CSS / JavaScript |
| 記事管理 | `data/articles.js`（クライアントサイド JS） |
| ホスティング | GitHub Pages |
| CI/CD | GitHub Actions（mainブランチpush → 自動デプロイ） |
| 外部ライブラリ | Swiper.js v11（CDN）、Google Fonts |

サーバーサイド処理は一切なく、全てクライアントサイドで完結します。

### 公開ページとナビの統一

| ページ | 役割 |
|---|---|
| `index.html` | 正規トップ（ヒーロー・記事抜粋・取材依頼 `#contact`） |
| `articles.html` | 記事一覧（キーワード検索 `?q=`・カテゴリ `?cat=` で絞り込み可能） |
| `article.html`（`?id=` 付き） | 記事詳細（データ駆動） |
| `editor.html` | 記者紹介 |
| `privacy.html` / `disclaimer.html` | 法務 |

グローバルナビ（本番系）は **記事一覧 → `articles.html`、記者紹介 → `editor.html`、取材依頼 → `index.html#contact`** で統一しています。

---

## 2. セットアップ

### 前提条件

- Node.js 18.0.0 以上（記事追加スクリプト用）
- Git
- GitHub アカウント

### 手順

#### ① リポジトリをクローン

```bash
git clone https://github.com/<YOUR_USERNAME>/minnano-hyouban.git
cd minnano-hyouban
```

#### ② ローカルで動作確認

静的ファイルのため、任意の HTTP サーバーで開くだけで動作します。

```bash
# Python の場合（組み込みサーバー）
python3 -m http.server 8080

# Node.js の場合（npx serve）
npx serve .
```

ブラウザで `http://localhost:8080` を開いてください。

#### ③ GitHub Pages を有効化

1. GitHub でリポジトリを作成（パブリック推奨）
2. リポジトリの **Settings** → **Pages**
3. Source: **Deploy from a branch** → Branch: `main` / Folder: `/ (root)`
4. **Save** をクリック

または GitHub CLI を使う場合:

```bash
gh api repos/<YOUR_USERNAME>/minnano-hyouban/pages \
  --method POST \
  --field source='{"branch":"main","path":"/"}'
```

#### ④ GitHub Actions の確認

```bash
gh run list --limit 5
```

Actions が正常に完了すると、`https://<YOUR_USERNAME>.github.io/minnano-hyouban/` でサイトが公開されます。

---

## 3. 記事の追加方法

記事データは `_post/` ディレクトリに企業ごとの個別ファイルとして管理されています。

### 手順

#### ① `_post/` に記事ファイルを作成

```bash
# ファイル名: <slug>-<企業名>.js
# 例: _post/1234567890123456-new-service.js
```

ファイル内で以下の形式でデータを定義します：

```javascript
window.__POST_1234567890123456 = {
  slug: "1234567890123456",
  company: "新サービス",
  category: "キャリア・転職",
  // ...その他フィールド（下記セクション参照）
};
```

#### ② `data/articles.js` にキーを追加

```javascript
const __ALL_POST_KEYS = [
  "__POST_1794482170414453",   // SenoRich
  "__POST_2252563132716439",   // TASKUL
  "__POST_1234567890123456"    // ← 新規追加
];
```

#### ③ HTMLファイルにスクリプトタグを追加

`index.html`・`article.html`・`articles.html`・`editor.html` の `<!-- 個別記事データ -->` セクションに追加：

```html
<script src="_post/1234567890123456-new-service.js"></script>
```

#### ④ 検証

```bash
npm run validate
```

---

## 4. デプロイ手順

`main` ブランチに push するだけで自動デプロイされます。

```bash
# 記事を追加した場合の典型的なワークフロー
git add data/articles.js
git commit -m "記事追加: [企業名]の評判記事"
git push origin main

# デプロイ状況の確認
gh run list --limit 3
```

GitHub Actions が成功すると、約1〜2分でサイトに反映されます。

### デプロイの流れ

```
git push → GitHub Actions 起動
  ↓
validate-articles.js（記事データ検証）
  ↓
GitHub Pages へアップロード
  ↓
公開URL: https://<USERNAME>.github.io/<REPO>/
```

検証でエラーが検出された場合、デプロイは中断されます。

---

## 4-1. CMS不要の運用フロー（記事月10本想定）

月10本程度であれば、重いCMSは不要です。`data/articles.js` を Git（mainブランチ）で更新し、公開前に必ず検証を通します。

### 基本フロー
- 記事追加/編集（`admin.html` / CLI / 直接編集）
- `npm run validate` を実行して、検証エラーが無いことを確認
- `git add data/articles.js` → `git commit` → `git push origin main`
- GitHub Actions が完了するのを待って、サイト反映を確認

### 運用ルール（編集者向け）
- `slug` は公開後、原則変更しない（URLが固定されるため）
- `officialUrl` は記事ごとに管理する（準備中は `"#"`、公開済みは有効URL）
- 事実（氏名・肩書・所属・団体名等）はファクトチェック前提で反映し、誇張・推測表現は避ける
- `metaDesc` / `heroTitle` / `faqs` は AI 概要・検索の要約対象になりやすいため、欠落が無い状態で登録する

### 推奨（PR運用）
実運用では `content/*` ブランチで PR を作り、差分レビューしてから `main` へマージすると安全です（公開前の第三者確認も可能になります）。

### GA4・公式リンクのUTM（本番）

- **測定ID**（`G-` で始まる文字列）を、各HTMLの `<meta name="ga4-measurement-id" content="...">` に設定するか、ページ読み込み前に `window.__GA4_MEASUREMENT_ID__` を設定する。プレースホルダのままでは `js/site-analytics.js` / `article-renderer.js` は読み込みません。
- **記事の公式CTA** は `article-renderer.js` が `officialUrl` に UTM をマージする（`docs/outbound-tracking-guide.md`）。無効化は `article.html` 内のコメント例どおり `window.__OFFICIAL_LINK_UTM__ = false;`（`article-renderer.js` より前）。

---

## 5. ファイル構成

```
minnano-hyouban/
│
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages 自動デプロイ設定
│
├── _post/                      # 企業別の記事データ（1ファイル = 1記事）
│   ├── 1794482170414453-senorich.js
│   └── 2252563132716439-taskul.js
│
├── data/
│   └── articles.js             # 記事データ集約ローダー（_post/ を window.ARTICLES に統合）
│
├── scripts/
│   ├── add-article.js          # 記事追加 CLI スクリプト
│   └── validate-articles.js    # 記事データ検証スクリプト
│
├── docs/                       # 運用ドキュメント・内部資料
│   ├── outbound-tracking-guide.md   # 公式サイト遷移の計測（GA4・UTM）
│   ├── article-field-mapping.md     # 取材項目 ↔ articles.js 対応表
│   ├── article-format.html          # 記事投稿フォーマットガイド
│   ├── article-template.json        # 新規記事のデフォルトテンプレート
│   ├── hearing-sheet.md             # ヒアリングシート（1枚）
│   ├── prompts/
│   │   └── article-ai-prompt-template.md  # AIドラフト用プロンプト型
│   ├── operations-runbook.md        # 公開・請求・運用契約メモ
│   ├── legal-ga-utm-checklist.md    # PR・GA・UTM・クレーム表示チェック
│   ├── framework.csv / .xlsx        # 設計フレームワーク
│   └── next-steps-from-meeting.md   # 議事録ベースの次タスクガイド
│
├── js/
│   └── site-analytics.js            # トップ等の GA4 読み込み（記事は article-renderer.js）
├── images/                     # 記事用画像（`images/README.md` に必要素材の一覧あり）
│
├── index.html                  # トップページ（正規トップ・ヒーロー・記事抜粋）
├── index.css                   # トップページ CSS
├── articles.html               # 記事一覧ページ
├── article.html                # 記事個別ページ（?id=<slug> で動的描画）
├── article-renderer.js         # 記事個別ページのレンダリング・GA4・公式URLのUTM
├── style.css                   # articles.html / article.html 共通 CSS
├── main.js                     # メイン JS（レビュー・FAQ 等）
│
├── package.json                # Node.js プロジェクト設定
└── README.md                   # このファイル
```

---

## 6. 記事データの構造

`data/articles.js` の各記事オブジェクトは以下の構造を持ちます。

### 識別子・メタ情報

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `slug` | string | 必須 | URL識別子（英小文字・数字・ハイフンのみ）|
| `title` | string | 必須 | SEO タイトル（h1 にも使用）|
| `metaDesc` | string | 必須 | meta description（120字以内推奨）|
| `ogImage` | string | 推奨 | OGP 画像 URL（1200×630px 推奨）|
| `company` | string | 必須 | 企業・サービス名 |
| `category` | string | 必須 | カテゴリ（下記参照）|
| `publishedAt` | string | 必須 | 公開日 `YYYY-MM-DD` |
| `updatedAt` | string | 推奨 | 更新日 `YYYY-MM-DD` |

**カテゴリの選択肢：**  
`キャリア・転職` / `美容・健康` / `語学・スキル` / `マネー・投資` / `ライフスタイル`

### ヒーローセクション

| フィールド | 説明 |
|---|---|
| `heroTag` | ヒーロー上部のタグ文字（例: "SNSで話題！"）|
| `heroTitle` | h1 見出し（`<br>` で改行可）|
| `heroSub` | サブコピー（記事一覧のエクサープトにも使用）|

### 記者情報

| フィールド | 説明 |
|---|---|
| `editorName` | 記者名（"記者：漆沢 祐樹" 形式）|
| `editorTitle` | 記者肩書き |
| `editorImg` | 記者顔写真 URL（64×64px 以上）|
| `checkItems` | 「この記事でわかること」リスト（3項目推奨）|

### レビュー

```javascript
reviews: [
  {
    id:    1,            // 一意のID（連番）
    name:  "田中 M様",  // 投稿者名
    age:   "32歳・女性", // 年代・性別
    stars: 5,            // 評価（1〜5の整数）
    tag:   "効果実感",   // 特徴タグ
    text:  "..."         // レビュー本文（50〜200字推奨）
  }
]
```

> レビューの `stars` の平均値がトップページ・記事ページのスコアとして自動計算されます。

### その他フィールド

| フィールド | 説明 |
|---|---|
| `galleries.service` | サービス写真スライダー `[{src, alt, caption}]` |
| `galleries.beforeAfter` | ビフォーアフター画像ペア `[{src, alt, label}]` |
| `galleries.media` | メディア掲載ロゴ `[{src, alt}]` |
| `serviceCards` | サービス概要カード `[{icon, title, text}]` |
| `steps` | 利用ステップ `[{title, text}]` |
| `faqs` | FAQ `[{q, a}]` |
| `storyText` | 創業ストーリー本文（段落ごとの配列）|
| `officialUrl` | 公式サイト URL（CTA ボタンのリンク先）|
| `ctaBtn` | CTA ボタンのラベルテキスト |

---

## 7. よくある質問・トラブルシューティング

### Q. 記事を追加したのにトップページに反映されない

**A.** 以下を確認してください：

1. `data/articles.js` の構文エラーがないか → `npm run validate` で確認
2. ブラウザのキャッシュをクリア（Ctrl+Shift+R / Cmd+Shift+R）
3. `index.html` が `data/articles.js` を読み込んでいるか確認

### Q. GitHub Actions のデプロイが失敗する

**A.** よくある原因：

- `data/articles.js` の構文エラー（カンマ忘れ・括弧の不一致など）
- Actions のログを確認 → `gh run view --log`
- ローカルで `npm run validate` を実行してエラーを確認

### Q. 記事個別ページが表示されない

**A.** URLを確認してください：

```
✅ 正: article.html?id=sample-coaching
❌ 誤: article.html?id=Sample-Coaching  （大文字・小文字を区別）
```

`data/articles.js` の `slug` フィールドと URL のパラメータが完全一致している必要があります。

### Q. GitHub Pages で CSS や JS が読み込まれない

**A.** リポジトリ名がサブパスになっている場合の問題です。  
`index.html` のリソースパスが相対パスになっていることを確認してください（`./` 始まりまたはファイル名のみ）。

### Q. スコアが表示されない

**A.** `reviews` 配列が空、または `stars` フィールドが数値でない場合にスコアが表示されません。  
各レビューの `stars` が `1`〜`5` の **数値** であることを確認してください（文字列 `"5"` は不可）。

### Q. CLIスクリプトがエラーになる

**A.** Node.js のバージョンを確認してください：

```bash
node --version  # v18.0.0 以上が必要
```

---

## ライセンス

© 2026 みんなの評判.com All Rights Reserved.

本リポジトリのコードは社内利用のみを目的としています。
