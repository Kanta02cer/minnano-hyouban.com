#!/usr/bin/env node
/**
 * ================================================================
 *  みんなの評判.com — _post/ 自動同期スクリプト
 *
 *  _post/*.js を自動検出し、以下を更新する：
 *    1. data/articles.js の __ALL_POST_KEYS 配列
 *    2. index.html / article.html / articles.html の <script> タグ
 *
 *  GitHub Actions（deploy.yml）から compile-drafts の前に実行される。
 *  ローカルでも `node scripts/sync-posts.js` で手動実行可能。
 * ================================================================
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const POST_DIR    = path.join(ROOT, '_post');
const ARTICLES_JS = path.join(ROOT, 'data', 'articles.js');
const HTML_FILES  = ['index.html', 'article.html', 'articles.html'].map(f => path.join(ROOT, f));

// ── 1. _post/*.js を検出（ルート直下のみ）─────────────────────────
const postFiles = fs.existsSync(POST_DIR)
  ? fs.readdirSync(POST_DIR)
      .filter(f => f.endsWith('.js'))
      .sort()
  : [];

if (postFiles.length === 0) {
  console.log('_post/ に .js ファイルがありません。スキップします。');
  process.exit(0);
}

// slug = ファイル名から最初の "-" の前の数字部分
function slugFromFilename(filename) {
  const m = filename.match(/^(\d+)/);
  return m ? m[1] : filename.replace(/\.js$/, '');
}

const posts = postFiles.map(f => ({
  filename: f,
  slug: slugFromFilename(f),
  key: `__POST_${slugFromFilename(f)}`,
}));

console.log(`検出した _post ファイル (${posts.length}件):`);
posts.forEach(p => console.log(`  ${p.filename}  →  ${p.key}`));

// ── 2. data/articles.js の __ALL_POST_KEYS を更新 ──────────────────
if (!fs.existsSync(ARTICLES_JS)) {
  console.error(`❌ ${ARTICLES_JS} が見つかりません。`);
  process.exit(1);
}

let articlesContent = fs.readFileSync(ARTICLES_JS, 'utf8');

// __ALL_POST_KEYS = [ ... ] ブロックを丸ごと置換
const keysLines = posts
  .map((p, i) => {
    const comma = i < posts.length - 1 ? ',' : '';
    const label = p.filename.replace(/\.js$/, '');
    return `  "${p.key}"${comma}   // ${label}`;
  })
  .join('\n');

const newKeysBlock = `const __ALL_POST_KEYS = [\n${keysLines}\n];`;

if (/const __ALL_POST_KEYS\s*=\s*\[[\s\S]*?\];/.test(articlesContent)) {
  articlesContent = articlesContent.replace(
    /const __ALL_POST_KEYS\s*=\s*\[[\s\S]*?\];/,
    newKeysBlock
  );
} else {
  // ブロックが見つからない場合は先頭に追記
  articlesContent = newKeysBlock + '\n\n' + articlesContent;
}

fs.writeFileSync(ARTICLES_JS, articlesContent, 'utf8');
console.log('✅ data/articles.js の __ALL_POST_KEYS を更新しました。');

// ── 3. HTML ファイルの <script> タグを更新 ───────────────────────────
const newScriptBlock =
  '  <!-- 個別記事データ（_post/） -->\n' +
  posts.map(p => `  <script src="_post/${p.filename}"></script>`).join('\n');

for (const htmlPath of HTML_FILES) {
  if (!fs.existsSync(htmlPath)) {
    console.warn(`⚠ ${htmlPath} が見つかりません。スキップ。`);
    continue;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');

  // <!-- 個別記事データ（_post/） --> ブロック全体を置換
  const blockRe = /[ \t]*<!-- 個別記事データ（_post\/）-->[\s\S]*?(?=\n[ \t]*<!-- (?!個別記事)|\n[ \t]*<script(?! src="_post\/)|\n[ \t]*<\/body)/;

  if (/<!-- 個別記事データ（_post\/）-->/.test(html)) {
    // コメントと直後の <script src="_post/..."> 行群をまとめて置換
    html = html.replace(
      /([ \t]*<!-- 個別記事データ（_post\/）-->)([\s\S]*?)(?=\n[ \t]*<!-- (?!個別記事)|\n[ \t]*<script(?! src="_post\/)|\n[ \t]*<\/body)/,
      newScriptBlock
    );
  } else {
    // ブロックが無い場合: data/articles.js の <script> 行の直前に挿入
    html = html.replace(
      /([ \t]*<script src="data\/articles\.js"><\/script>)/,
      `${newScriptBlock}\n  $1`
    );
  }

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`✅ ${path.basename(htmlPath)} の <script> タグを更新しました。`);
}

console.log('\n✅ sync-posts 完了。');
