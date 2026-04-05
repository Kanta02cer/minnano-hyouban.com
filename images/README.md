# 画像素材ギャラリー（要件一覧）

実ファイルは `images/` 配下に置き、`data/articles.js` では **`images/...` からの相対パス**で参照します。

---

## 記事データ 1本あたり（`article-template.json` / `data/articles.js`）

### OGP画像（`ogImage`）

- **用途**: 記事URLをSNS等でシェアしたときのプレビュー画像
- **フィールド**: `ogImage`（URL文字列）
- **サイズ**: **1200 × 630 px**（推奨）
- **形式**: JPG または PNG
- **枚数**: **1枚**
- **メタデータ**: ファイルパス以外に、OGP用の説明は `metaDesc` 等で別途設定

### 記者顔写真（`editorImg`）

- **用途**: 記事内の記者紹介・ヘッダーまわり
- **フィールド**: `editorImg`
- **サイズ**: **64 × 64 px**、**正方形**
- **形式**: JPG または PNG
- **枚数**: **1枚**
- **メタデータ**: `alt` を必ず設定（記者名が分かる内容）

### サービスギャラリー G1（`galleries.service[]`）

- **用途**: サービス環境・対応シーン・機材などの横スライダー
- **フィールド**: `galleries.service[].src` / `.alt` / `.caption`
- **サイズ**: **800 × 600 px**（横長想定）
- **形式**: JPG または PNG
- **枚数**: **3枚推奨**（運用で増減可。未設定時はプレースホルダーが入る）
- **メタデータ**: 各枚に **`alt`** と **キャプション**（20〜40字目安）

### ビフォーアフター G2（`galleries.beforeAfter[]`）

- **用途**: 利用前後の対比スライダー
- **フィールド**: `galleries.beforeAfter[].src` / `.alt` / `.label`
- **サイズ**: **600 × 400 px**
- **形式**: JPG または PNG
- **枚数**: **2枚**（Before 1枚 + After 1枚）
- **メタデータ**: **ラベル**（例: 「受講前」「3ヶ月後」）を画像の意味が伝わるように

### メディア掲載ロゴ G3（`galleries.media[]`）

- **用途**: 「メディア掲載実績」欄の横並びロゴ
- **フィールド**: `galleries.media[].src` / `.alt`
- **サイズ**: **120 × 40 px** 目安（横長ロゴ）
- **形式**: **PNG（背景透過）推奨**
- **枚数**: **3枚以上**（任意セクション。未掲載なら空配列可）
- **注意**: **実際に掲載された媒体のロゴのみ**。利用許諾が必要な場合は事前確認

### 創業ストーリー（`storyImg`）

- **用途**: 「このメディアを始めた理由」などの代表者・創業者写真
- **フィールド**: `storyImg` / `storyAlt`
- **サイズ**: **200 × 200 px**、**正方形**
- **形式**: JPG または PNG
- **枚数**: **1枚**（セクション省略時は未設定可）
- **メタデータ**: **`storyAlt`** で alt を必ず設定

### 全画像共通（記事データ）

- **`alt`**: スクリーンリーダー用。装飾のみの画像は空にしない方針で、意味のある説明を付ける
- **保存場所**: 原則 `images/` 以下（記事専用フォルダ `images/articles/スラッグ/` などに分けてもよい）
- **詳細仕様**: `article-format.html` の G1 / G2 / G3・記者・ストーリー各節を参照

---

## サイト共通（トップ・一覧・記者ページ）

### トップページ（`index.html`）

- **記者ポートレート**
  - 縦長ポートレート想定（表示上 **約 180 × 220 px** 相当）
  - 本番用: `images/urushizawa-portrait.jpg`（長辺 720px にリサイズ済み）
- **注目記事（1件目）**
  - 横長ワイド。**記事データのサムネ**（例: `galleries.service[0]`）を利用
  - 記事がない場合は `featured-upcoming-wide.svg` 相当のプレースホルダー
- **最新記事カード（最大3件）**
  - 各記事の **横長サムネ**（同上）
  - 不足分は `thumb-upcoming.svg` 相当の「準備中」用

### 記者紹介ページ（`editor.html`）

- **プロフィール写真**
  - ポートレート（表示 **160 × 200** 前後の想定）
  - 本番用: `images/urushizawa-portrait.jpg`（トップと共通）

### 記事一覧（`articles.html`）

- **各カードのサムネ**
  - 原則 **その記事の `galleries.service[0].src`**
  - 未設定時は `card-thumb-generic.svg` にフォールバック

---

## 記者写真（本番・`images/` 直下）

漆沢記者の顔写真用に、次を生成・参照しています（元画像は `images/` に格納された写真から `sips` で作成）。

- **`urushizawa-portrait.jpg`** — ヒーロー・記者ページ用（長辺 720px）
- **`urushizawa-avatar.jpg`** — 記事内記者欄・一覧メタ用の **正方形 256×256px**（表示は 64px 相当＋高解像度ディスプレイ向け）
- **`urushizawa-story.jpg`** — 創業ストーリー欄用 **200×200px**（`storyImg` デフォルト）

差し替え時は元JPEGを差し替え、同じファイル名で上書きするか、パスを `articles.js` / テンプレート側で更新してください。

※ `images/` に **横長の元JPEG**（例: 3240×2160）が別途ある場合は、OG画像（1200×630）など別用途に利用できます。記事の `ogImage` は現状カテゴリ別SVGのままです。

---

## プレースホルダー（`images/placeholders/`）

実素材がないとき参照される **SVG**。本番では実画像・公式ロゴへの差し替えを推奨。

- **`avatar-reporter.svg`** — 記者アイコン（`editorImg` 未設定時のフォールバック。本番は `urushizawa-avatar.jpg` を使用）
- **`editor-portrait.svg`** — トップ・記者ページ（本番は `urushizawa-portrait.jpg`）
- **`story-portrait.svg`** — ストーリー（本番は `urushizawa-story.jpg`）
- **`gallery-photo.svg`** — G1 サービス画像
- **`gallery-before.svg`** / **`gallery-after.svg`** — G2 Before / After
- **`media-logo.svg`** — G3 メディアロゴ
- **`og-career.svg`** / **`og-beauty.svg`** — OGP用テンプレ（カテゴリに合わせて選択可）
- **`card-thumb-generic.svg`** — 一覧・トップの汎用サムネ
- **`card-wide-generic.svg`** — トップ注目エリア用ワイド
- **`featured-upcoming-wide.svg`** — 注目枠「準備中」
- **`thumb-upcoming.svg`** — カード「準備中」サムネ

---

## 納品・運用

- 新規記事では **先に `images/` にファイルを置き**、`articles.js` のパスを更新してからコミットする
- メディアロゴは **掲載の事実とロゴの利用条件**を満たすものだけを使う
- 解像度・撮影の目安は **`article-format.html`** の各ギャラリー節と揃える
