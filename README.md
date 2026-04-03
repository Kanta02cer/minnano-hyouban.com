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

### 方法A：CLIスクリプト（推奨）

対話形式で必要事項を入力するだけで `data/articles.js` に記事が追加されます。

```bash
node scripts/add-article.js
# または
npm run add-article
```

**入力項目：**

| 項目 | 説明 | 必須 |
|---|---|---|
| スラッグ | URL識別子（例: `abc-service`） | 必須 |
| 企業・サービス名 | 記事に掲載する企業名 | 必須 |
| カテゴリ | 1〜5の番号で選択 | 必須 |
| 公開日 | YYYY-MM-DD 形式（省略で今日） | 推奨 |
| ヒーロータイトル | h1見出し（省略で自動生成） | 推奨 |
| サブコピー | 記事概要・エクサープト | 推奨 |
| 公式サイトURL | CTAボタンのリンク先 | 推奨 |

スクリプト実行後、レビュー・FAQ・ギャラリーは `data/articles.js` を直接編集して追加します。

### 方法B：admin.html（ブラウザ）

1. ブラウザで `admin.html` を開く
2. フォームに全項目を入力
3. **「コードを生成」** ボタンをクリック
4. 生成されたコードを `data/articles.js` の配列末尾（コメントの直前）に貼り付け

### 方法C：data/articles.js を直接編集

`data/articles.js` を開き、配列の末尾のコメントブロックの直前に記事オブジェクトを追加します。

```javascript
window.ARTICLES = [
  { ...既存記事1... },
  { ...既存記事2... },

  // ↓ ここに追加（カンマを忘れずに）
  ,{
    slug: "new-service",
    company: "新サービス",
    category: "キャリア・転職",
    // ...その他フィールド
  }
];
```

追加後、必ず検証スクリプトを実行してください：

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

## 5. ファイル構成

```
minnano-hyouban/
│
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages 自動デプロイ設定
│
├── data/
│   └── articles.js             # 記事データストア（window.ARTICLES = [...]）
│
├── scripts/
│   ├── add-article.js          # 記事追加 CLI スクリプト
│   └── validate-articles.js    # 記事データ検証スクリプト
│
├── images/                     # 記事用画像（実際の画像をここに格納）
│
├── index.html                  # トップページ（記事一覧・ヒーロー）
├── index.css                   # トップページ CSS
├── top.html                    # 別デザインのトップページ
├── top.css                     # 別デザイン CSS
├── articles.html               # 記事一覧ページ
├── article.html                # 記事個別ページ（?id=<slug> で動的描画）
├── article-renderer.js         # 記事個別ページのレンダリングエンジン
├── admin.html                  # 記事管理画面（ブラウザで開いて使用）
├── style.css                   # articles.html / article.html / admin.html 共通 CSS
├── main.js                     # メイン JS（レビュー・FAQ 等）
│
├── article-template.json       # 新規記事のデフォルトテンプレート
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
