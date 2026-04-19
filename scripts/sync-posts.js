#!/usr/bin/env node
/**
 * ================================================================
 *  みんなの評判.com — _post/ 自動同期スクリプト
 *
 *  _post/ 以下を再帰的にスキャンして .js ファイルを検出し、
 *  以下を自動更新する：
 *    1. data/articles.js の __ALL_POST_KEYS 配列
 *    2. index.html / article.html / articles.html の <script> タグ
 *
 *  ディレクトリ構成例（どちらも対応）:
 *    _post/1234567890123456-company.js          ← ルート直下
 *    _post/CompanyName/1234567890123456-company.js  ← サブディレクトリ
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

// ── 1. _post/ を再帰スキャンして .js ファイルを収集 ──────────────────
function collectPostFiles(dir, baseDir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // .DS_Store 等を除外
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectPostFiles(fullPath, baseDir));
    } else if (entry.name.endsWith('.js')) {
      // _post/ からの相対パス（HTMLのsrc属性に使用）
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ relPath, filename: entry.name });
    }
  }
  return results;
}

const allPostFiles = collectPostFiles(POST_DIR, path.join(ROOT)).sort((a, b) =>
  a.filename.localeCompare(b.filename)
);

if (allPostFiles.length === 0) {
  console.log('_post/ に .js ファイルがありません。スキップします。');
  process.exit(0);
}

// slug = ファイル名の先頭の連続する数字
function slugFromFilename(filename) {
  const m = filename.match(/^(\d+)/);
  return m ? m[1] : filename.replace(/\.js$/, '');
}

// スラッグが重複する場合は先に見つかったもの（ルート優先→アルファベット順）を使用
const seenSlugs = new Set();
const posts = [];
for (const f of allPostFiles) {
  const slug = slugFromFilename(f.filename);
  if (seenSlugs.has(slug)) {
    console.warn(`⚠ slug重複をスキップ: ${f.relPath} (slug=${slug})`);
    continue;
  }
  seenSlugs.add(slug);
  posts.push({ ...f, slug, key: `__POST_${slug}` });
}

console.log(`検出した _post ファイル (${posts.length}件):`);
posts.forEach(p => console.log(`  ${p.relPath}  →  ${p.key}`));

// ── 2. data/articles.js の __ALL_POST_KEYS を更新 ──────────────────
if (!fs.existsSync(ARTICLES_JS)) {
  console.error(`❌ ${ARTICLES_JS} が見つかりません。`);
  process.exit(1);
}

let articlesContent = fs.readFileSync(ARTICLES_JS, 'utf8');

const keysLines = posts
  .map((p, i) => {
    const comma = i < posts.length - 1 ? ',' : '';
    const label = p.relPath.replace(/\.js$/, '');
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
  articlesContent = newKeysBlock + '\n\n' + articlesContent;
}

fs.writeFileSync(ARTICLES_JS, articlesContent, 'utf8');
console.log('✅ data/articles.js の __ALL_POST_KEYS を更新しました。');

// ── 3. HTML ファイルの <script> タグを更新 ───────────────────────────
const newScriptBlock =
  '  <!-- 個別記事データ（_post/） -->\n' +
  posts.map(p => `  <script src="${p.relPath}"></script>`).join('\n');

for (const htmlPath of HTML_FILES) {
  if (!fs.existsSync(htmlPath)) {
    console.warn(`⚠ ${htmlPath} が見つかりません。スキップ。`);
    continue;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');

  // 既存の _post コメント行と続く <script src="_post/..."> 行を全て削除
  html = html.replace(
    /[ \t]*<!--\s*個別記事データ（_post\/）\s*-->\n([ \t]*<script src="_post\/[^"]+"><\/script>\n)*/g,
    ''
  );

  // data/articles.js の <script> 行の直前に新しいブロックを挿入
  if (html.includes('<script src="data/articles.js">')) {
    html = html.replace(
      /([ \t]*<script src="data\/articles\.js"><\/script>)/,
      `${newScriptBlock}\n  $1`
    );
  } else {
    console.warn(`⚠ ${path.basename(htmlPath)}: data/articles.js の script タグが見つかりません。末尾に追記します。`);
    html = html.replace('</body>', `${newScriptBlock}\n</body>`);
  }

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`✅ ${path.basename(htmlPath)} の <script> タグを更新しました。`);
}

console.log('\n✅ sync-posts 完了。');
