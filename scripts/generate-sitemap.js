#!/usr/bin/env node
/**
 * ================================================================
 *  みんなの評判.com — サイトマップ自動生成スクリプト
 *
 *  _post/ 以下の記事JSを解析して sitemap.xml を自動生成する。
 *  記事の ogImage・title・publishedAt を読み取り、
 *  画像サイトマップ（image:image）も同時に出力する。
 *
 *  使い方: node scripts/generate-sitemap.js
 * ================================================================
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT        = path.resolve(__dirname, '..');
const POST_DIR    = path.join(ROOT, '_post');
const SITEMAP_OUT = path.join(ROOT, 'sitemap.xml');
const BASE_URL    = 'https://minnano-hyouban.com';
const TODAY       = new Date().toISOString().slice(0, 10);

// ── _post/ を再帰スキャンして .js を収集 ─────────────────────────────
function collectPostFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectPostFiles(full));
    } else if (entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

// ── 記事JSからデータを抽出（VM サンドボックスで安全に実行）────────────
function extractArticleData(filePath) {
  try {
    const src = fs.readFileSync(filePath, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { timeout: 3000 });

    // window.__POST_xxxx 形式で格納されているデータを取り出す
    const postKeys = Object.keys(sandbox.window).filter(k => k.startsWith('__POST_'));
    if (postKeys.length === 0) return null;

    const data = sandbox.window[postKeys[0]];
    return data || null;
  } catch (err) {
    console.warn(`  ⚠️  ${path.basename(filePath)}: ${err.message}`);
    return null;
  }
}

// ── XML エスケープ ────────────────────────────────────────────────
function xmlEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── 画像URL を絶対URLに解決 ────────────────────────────────────────
function resolveImageUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//.test(u)) return u;
  return `${BASE_URL}/${u.replace(/^\//, '')}`;
}

// ── 静的ページ定義 ────────────────────────────────────────────────
const STATIC_PAGES = [
  { loc: '/',              lastmod: TODAY, changefreq: 'weekly',  priority: '1.0' },
  { loc: '/articles.html', lastmod: TODAY, changefreq: 'weekly',  priority: '0.6' },
  { loc: '/editor.html',   lastmod: TODAY, changefreq: 'monthly', priority: '0.7' },
  { loc: '/privacy.html',  lastmod: TODAY, changefreq: 'yearly',  priority: '0.4' },
  { loc: '/disclaimer.html', lastmod: TODAY, changefreq: 'yearly', priority: '0.4' },
];

// ── メイン処理 ────────────────────────────────────────────────────
const postFiles = collectPostFiles(POST_DIR);
const articles = [];

for (const file of postFiles) {
  const data = extractArticleData(file);
  if (!data || !data.slug) continue;
  articles.push(data);
  console.log(`  ✅ ${data.slug} — ${data.company || '(no company)'}`);
}

articles.sort((a, b) => String(a.slug).localeCompare(String(b.slug)));

// ── XML 生成 ──────────────────────────────────────────────────────
const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  '',
  '  <!-- 静的ページ -->',
];

for (const page of STATIC_PAGES) {
  lines.push('  <url>');
  lines.push(`    <loc>${BASE_URL}${page.loc}</loc>`);
  lines.push(`    <lastmod>${page.lastmod}</lastmod>`);
  lines.push(`    <changefreq>${page.changefreq}</changefreq>`);
  lines.push(`    <priority>${page.priority}</priority>`);
  lines.push('  </url>');
  lines.push('');
}

if (articles.length > 0) {
  lines.push('  <!-- 個別記事（slug = 16桁数値ID）— 最高優先度で指名検索上位を狙う -->');
  for (const a of articles) {
    const loc      = `${BASE_URL}/article.html?id=${encodeURIComponent(a.slug)}`;
    const lastmod  = a.updatedAt || a.publishedAt || TODAY;
    const imageUrl = resolveImageUrl(a.ogImage);
    const title    = a.title || (a.company ? `${a.company}の口コミ評判｜みんなの評判.com` : '');
    const company  = (a.company || '').split(/[（(]/)[0].trim();

    lines.push('  <url>');
    lines.push(`    <loc>${xmlEsc(loc)}</loc>`);
    lines.push(`    <lastmod>${xmlEsc(lastmod)}</lastmod>`);
    lines.push('    <changefreq>monthly</changefreq>');
    lines.push('    <priority>0.9</priority>');
    if (imageUrl) {
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${xmlEsc(imageUrl)}</image:loc>`);
      lines.push(`      <image:title>${xmlEsc(title)}</image:title>`);
      lines.push(`      <image:caption>${xmlEsc(company)}の口コミ・評判｜みんなの評判.com</image:caption>`);
      lines.push('    </image:image>');
    }
    lines.push('  </url>');
    lines.push('');
  }
}

lines.push('</urlset>');

const xml = lines.join('\n');
fs.writeFileSync(SITEMAP_OUT, xml, 'utf8');
console.log(`\n✅ sitemap.xml を生成しました（静的${STATIC_PAGES.length}件 + 記事${articles.length}件）`);
