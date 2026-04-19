/**
 * ================================================================
 *  みんなの評判.com — 記事データ集約ローダー
 * ================================================================
 *
 * ■ 仕組み
 *   各記事データは _post/ ディレクトリに個別ファイルとして格納されています。
 *   各ファイルは window.__POST_<slug> にデータを定義します。
 *   このローダーが全ての個別データを window.ARTICLES 配列に集約します。
 *
 * ■ 記事の追加方法
 *   1. _post/ に新しい記事ファイルを作成
 *      例: _post/1234567890123456-company-name.js
 *   2. ファイル内で window.__POST_1234567890123456 = { ... } を定義
 *   3. このファイルの __ALL_POST_KEYS 配列にキーを追加
 *   4. HTMLファイル (index.html, article.html, articles.html) に
 *      <script src="_post/xxx.js"></script> を追加
 *
 * ■ 主なフィールド
 *   slug        : URL識別子（16桁数値ID）例: "1794482170414453"
 *   company     : 企業・サービス名
 *   category    : "キャリア・転職" / "美容・健康" / "語学・スキル" /
 *                 "マネー・投資" / "ライフスタイル"
 *   publishedAt : 公開日 "YYYY-MM-DD"
 *   heroTitle   : ヒーローh1（<br>で改行可）
 *   heroSub     : サブコピー（記事一覧のエクサープトにも使用）
 *   reviews     : [{id, name, age, stars(1-5), tag, text}]
 *   officialUrl : 公式サイトURL（CTAボタン）
 *
 * ================================================================
 */

// 全ての _post ファイルのグローバル変数キーを列挙
const __ALL_POST_KEYS = [
  "__POST_1794482170414453",   // _post/SenoRich/1794482170414453-senorich
  "__POST_2221437250750372",   // _post/MIRACLE PILLOW/2221437250750372-miracle-pillow
  "__POST_2252563132716439"   // _post/TASKUL/2252563132716439-taskul
];

// 個別ファイルから読み込んだデータを集約
window.ARTICLES = __ALL_POST_KEYS
  .map(key => window[key])
  .filter(Boolean);
