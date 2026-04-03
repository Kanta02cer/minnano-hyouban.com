#!/usr/bin/env node
/**
 * ================================================================
 *  みんなの評判.com — 記事データ検証スクリプト
 *  使い方: node scripts/validate-articles.js
 *           または: npm run validate
 *  GitHub Actions からも自動実行される
 * ================================================================
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ARTICLES_JS = path.resolve(__dirname, '..', 'data', 'articles.js');

// ── 必須フィールド定義 ──────────────────────────────────────────
const REQUIRED_FIELDS = ['slug', 'company', 'heroTitle'];

const OPTIONAL_BUT_WARN_FIELDS = [
  'title', 'metaDesc', 'category', 'publishedAt',
  'heroSub', 'editorName', 'officialUrl',
];

const VALID_CATEGORIES = [
  'キャリア・転職',
  '美容・健康',
  '語学・スキル',
  'マネー・投資',
  'ライフスタイル',
];

// ── ロード ──────────────────────────────────────────────────────
function loadArticles() {
  if (!fs.existsSync(ARTICLES_JS)) {
    console.error(`❌ ファイルが見つかりません: ${ARTICLES_JS}`);
    process.exit(1);
  }

  const content = fs.readFileSync(ARTICLES_JS, 'utf8');
  const sandbox = { window: {} };

  try {
    vm.runInNewContext(content, sandbox);
  } catch (e) {
    console.error('❌ data/articles.js の構文エラー:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(sandbox.window?.ARTICLES)) {
    console.error('❌ window.ARTICLES が配列として定義されていません。');
    process.exit(1);
  }

  return sandbox.window.ARTICLES;
}

// ── 検証ロジック ────────────────────────────────────────────────
function validate(articles) {
  const errors   = [];
  const warnings = [];
  const slugSeen = new Set();

  articles.forEach((article, index) => {
    const label = `記事[${index}]${article.slug ? ` (${article.slug})` : ''}`;

    // 必須フィールドチェック
    for (const field of REQUIRED_FIELDS) {
      if (!article[field] || String(article[field]).trim() === '') {
        errors.push(`${label}: 必須フィールド "${field}" が未設定です。`);
      }
    }

    // スラッグ形式チェック
    if (article.slug) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(article.slug)) {
        errors.push(`${label}: slug "${article.slug}" の形式が不正です（英小文字・数字・ハイフンのみ）。`);
      }
      if (slugSeen.has(article.slug)) {
        errors.push(`${label}: slug "${article.slug}" が重複しています。`);
      }
      slugSeen.add(article.slug);
    }

    // カテゴリチェック
    if (article.category && !VALID_CATEGORIES.includes(article.category)) {
      warnings.push(`${label}: カテゴリ "${article.category}" は定義外の値です。（定義: ${VALID_CATEGORIES.join(' / ')}）`);
    }

    // 公開日形式チェック
    if (article.publishedAt && !/^\d{4}-\d{2}-\d{2}$/.test(article.publishedAt)) {
      warnings.push(`${label}: publishedAt "${article.publishedAt}" が YYYY-MM-DD 形式ではありません。`);
    }

    // URLチェック
    if (article.officialUrl && article.officialUrl !== '#') {
      try {
        new URL(article.officialUrl);
      } catch {
        warnings.push(`${label}: officialUrl "${article.officialUrl}" が有効なURLではありません。`);
      }
    }

    // オプション警告フィールド
    for (const field of OPTIONAL_BUT_WARN_FIELDS) {
      if (!article[field] || String(article[field]).trim() === '') {
        warnings.push(`${label}: フィールド "${field}" が未設定です（推奨）。`);
      }
    }

    // レビュー検証
    if (Array.isArray(article.reviews) && article.reviews.length > 0) {
      article.reviews.forEach((r, ri) => {
        if (typeof r.stars !== 'number' || r.stars < 1 || r.stars > 5) {
          warnings.push(`${label}: reviews[${ri}].stars は 1〜5 の数値である必要があります。`);
        }
      });
    } else {
      warnings.push(`${label}: reviews が未設定または空です。`);
    }
  });

  return { errors, warnings };
}

// ── メイン ──────────────────────────────────────────────────────
function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  みんなの評判.com — 記事データ検証');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const articles = loadArticles();
  console.log(`📂 data/articles.js: ${articles.length} 件の記事を読み込みました。\n`);

  articles.forEach((a, i) => {
    const score = Array.isArray(a.reviews) && a.reviews.length > 0
      ? (a.reviews.reduce((s, r) => s + (r.stars || 0), 0) / a.reviews.length).toFixed(1)
      : 'N/A';
    const reviews = Array.isArray(a.reviews) ? a.reviews.length : 0;
    console.log(`  ${String(i + 1).padStart(2)}. [${a.category || '?'}] ${a.company || '?'}` +
                ` (slug: ${a.slug || '?'}) — ★${score} / レビュー${reviews}件`);
  });

  const { errors, warnings } = validate(articles);

  console.log('');

  if (warnings.length > 0) {
    console.log(`⚠  警告 ${warnings.length} 件:`);
    warnings.forEach(w => console.log(`   - ${w}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log(`❌ エラー ${errors.length} 件（要修正）:`);
    errors.forEach(e => console.error(`   - ${e}`));
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }

  console.log(`✅ 検証完了: エラーなし（警告 ${warnings.length} 件）`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
