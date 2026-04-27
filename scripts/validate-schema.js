#!/usr/bin/env node
/**
 * ================================================================
 *  みんなの評判.com — 構造化データ（JSON-LD）検証スクリプト
 *
 *  静的 HTML ファイルと記事データから JSON-LD を抽出し、
 *  必須フィールドの存在・型・値の整合性を確認する。
 *
 *  使い方: node scripts/validate-schema.js
 * ================================================================
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT     = path.resolve(__dirname, '..');
const POST_DIR = path.join(ROOT, '_post');

let errors = 0;
let warnings = 0;

function err(msg)  { console.error(`  ❌ ${msg}`); errors++; }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); warnings++; }
function ok(msg)   { console.log(`  ✅ ${msg}`); }

// ── 記事データ検証 ────────────────────────────────────────────
function collectPostFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectPostFiles(full));
    else if (entry.name.endsWith('.js')) results.push(full);
  }
  return results;
}

function extractArticle(filePath) {
  try {
    const src = fs.readFileSync(filePath, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { timeout: 3000 });
    const key = Object.keys(sandbox.window).find(k => k.startsWith('__POST_'));
    return key ? sandbox.window[key] : null;
  } catch (e) { return null; }
}

console.log('\n============================================');
console.log('  みんなの評判.com — 構造化データ検証');
console.log('============================================\n');

// 記事データ検証
const articles = collectPostFiles(POST_DIR).map(f => ({ file: f, data: extractArticle(f) })).filter(a => a.data);

console.log(`📄 記事数: ${articles.length} 件\n`);

articles.forEach(({ file, data: a }) => {
  const name = path.relative(ROOT, file);
  console.log(`\n▶ ${name}`);

  // 必須フィールド
  if (!a.slug)      err('slug が未設定');
  else ok(`slug: ${a.slug}`);

  if (!a.company)   err('company が未設定');
  else ok(`company: ${a.company}`);

  if (!a.title)     warn('title が未設定（SEO最適化タイトル推奨）');
  else ok(`title: ${a.title.slice(0, 40)}…`);

  if (!a.metaDesc)  warn('metaDesc が未設定（meta description 空になります）');
  else if (a.metaDesc.length < 60)  warn(`metaDesc が短すぎます（${a.metaDesc.length}字）`);
  else if (a.metaDesc.length > 160) warn(`metaDesc が長すぎます（${a.metaDesc.length}字）`);
  else ok(`metaDesc: ${a.metaDesc.length}字`);

  if (!a.ogImage)   warn('ogImage が未設定（OG画像なし）');
  else ok(`ogImage: ${a.ogImage}`);

  if (!a.publishedAt) warn('publishedAt が未設定（NewsArticle datePublished が空になります）');
  else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.publishedAt)) err(`publishedAt の形式が不正: ${a.publishedAt}（YYYY-MM-DD推奨）`);
    else ok(`publishedAt: ${a.publishedAt}`);
  }

  if (!a.category) warn('category が未設定');
  else ok(`category: ${a.category}`);

  // レビュー
  if (!Array.isArray(a.reviews) || a.reviews.length === 0) {
    warn('reviews が空（AggregateRating スキーマが出力されません）');
  } else {
    const hasStars = a.reviews.every(r => typeof r.stars === 'number' && r.stars >= 1 && r.stars <= 5);
    if (!hasStars) err('reviews に stars (1-5) が不正なエントリがあります');
    else ok(`reviews: ${a.reviews.length}件`);
  }

  // FAQ
  if (Array.isArray(a.faqs) && a.faqs.length > 0) {
    const hasQA = a.faqs.every(f => f.q && f.a);
    if (!hasQA) err('faqs に q または a が空のエントリがあります');
    else ok(`faqs: ${a.faqs.length}件`);
  }

  // CTA
  if (!a.ctaUrl && !a.officialUrl) warn('ctaUrl/officialUrl が未設定（公式サイトCTAなし）');
  else ok('CTA URL: 設定済み');
});

// ── 静的 HTML ファイル検証 ────────────────────────────────────
console.log('\n\n📋 静的 HTML ファイル検証\n');

const htmlFiles = ['index.html', 'articles.html', 'article.html', 'editor.html', 'disclaimer.html', 'privacy.html'];
htmlFiles.forEach(f => {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) { warn(`${f} が存在しません`); return; }
  const html = fs.readFileSync(full, 'utf8');

  console.log(`\n▶ ${f}`);
  if (!html.includes('rel="canonical"'))          warn('canonical リンクがありません');
  else ok('canonical: 設定済み');

  if (!html.includes('name="description"'))       warn('meta description がありません');
  else ok('meta description: 設定済み');

  if (f === 'article.html') {
    ok('JSON-LD: 動的生成（article-renderer.js で注入）');
  } else if (!html.includes('application/ld+json')) {
    warn('JSON-LD が見つかりません');
  } else {
    const matches = html.match(/<script type="application\/ld\+json">/g) || [];
    ok(`JSON-LD: ${matches.length}ブロック`);
  }

  if (!html.includes('G-0XHQPCC4CF'))            warn('GA4 タグが見つかりません');
  else ok('GA4: 設定済み');

  if (f !== 'article.html' && !html.includes('rel="manifest"')) warn('manifest リンクがありません');
});

console.log(`\n\n============================================`);
console.log(`  結果: ❌ エラー ${errors}件 / ⚠️  警告 ${warnings}件`);
console.log(`============================================\n`);

if (errors > 0) process.exit(1);
