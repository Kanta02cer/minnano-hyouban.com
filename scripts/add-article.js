#!/usr/bin/env node
/**
 * ================================================================
 *  みんなの評判.com — 記事追加 CLI スクリプト
 *  使い方: node scripts/add-article.js
 *           または: npm run add-article
 * ================================================================
 */
'use strict';

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const vm       = require('vm');

const ROOT         = path.resolve(__dirname, '..');
const ARTICLES_JS  = path.join(ROOT, 'data', 'articles.js');
const TEMPLATE_JSON = path.join(ROOT, 'article-template.json');
const { generateSlugFromCategory } = require('./id-from-category');

// ── カテゴリ選択肢 ──────────────────────────────────────────────
const CATEGORIES = [
  'キャリア・転職',
  '美容・健康',
  '語学・スキル',
  'マネー・投資',
  'ライフスタイル',
];

// ── ユーティリティ ──────────────────────────────────────────────
function today() {
  return new Date().toISOString().split('T')[0];
}

function isValidSlug(s) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
}

function loadExistingArticles() {
  if (!fs.existsSync(ARTICLES_JS)) return [];
  const content = fs.readFileSync(ARTICLES_JS, 'utf8');
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(content, sandbox);
    return Array.isArray(sandbox.window.ARTICLES) ? sandbox.window.ARTICLES : [];
  } catch {
    return [];
  }
}

function loadTemplate() {
  if (!fs.existsSync(TEMPLATE_JSON)) {
    console.error('❌ article-template.json が見つかりません。');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(TEMPLATE_JSON, 'utf8'));
}

/** オブジェクトを見やすい JS リテラル文字列にシリアライズ（インデント2スペース）*/
function serialize(obj, depth = 0) {
  const indent  = '  '.repeat(depth + 1);
  const indent0 = '  '.repeat(depth);

  if (obj === null)             return 'null';
  if (typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'number')  return String(obj);
  if (typeof obj === 'string')  return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(v => indent + serialize(v, depth + 1));
    return `[\n${items.join(',\n')}\n${indent0}]`;
  }

  // object
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  const pairs = keys.map(k => `${indent}${k}: ${serialize(obj[k], depth + 1)}`);
  return `{\n${pairs.join(',\n')}\n${indent0}}`;
}

/** data/articles.js に新規記事を追記する */
function appendToArticlesJs(article) {
  let content = fs.readFileSync(ARTICLES_JS, 'utf8');

  // 挿入位置: コメントブロック開始 または 最後の `];` の直前
  const commentIdx = content.lastIndexOf('\n  /*');
  const bracketIdx = content.lastIndexOf('\n];');

  if (bracketIdx === -1) {
    throw new Error('data/articles.js のフォーマットが不正です（`];` が見つかりません）');
  }

  const insertAt = commentIdx > -1 && commentIdx < bracketIdx ? commentIdx : bracketIdx;
  const before   = content.substring(0, insertAt).trimEnd();
  const after    = content.substring(insertAt);

  // 直前の記事がカンマで終わっていない場合はカンマを補完
  const separator = before.endsWith(',') ? '' : ',';

  const articleStr = '  ' + serialize(article, 0)
    .split('\n')
    .map((line, i) => i === 0 ? line : '  ' + line)
    .join('\n');

  const newContent = before + separator + '\n\n' + articleStr + '\n' + after;
  fs.writeFileSync(ARTICLES_JS, newContent, 'utf8');
}

// ── インタラクティブ入力 ────────────────────────────────────────
function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  みんなの評判.com — 記事追加ウィザード');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const existing = loadExistingArticles();
  const template  = loadTemplate();

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });

  try {
    // ── 1. 企業・サービス名 ────────────────────────────────────
    let company = '';
    while (!company) {
      company = await ask(rl, '🏢 企業・サービス名: ');
      if (!company) console.log('  ⚠  企業名は必須です。');
    }

    // ── 2. カテゴリ ────────────────────────────────────────────
    console.log('\nカテゴリを番号で選択してください:');
    CATEGORIES.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
    let category = '';
    while (!category) {
      const catInput = await ask(rl, 'カテゴリ番号: ');
      const idx = parseInt(catInput, 10) - 1;
      if (idx >= 0 && idx < CATEGORIES.length) {
        category = CATEGORIES[idx];
      } else {
        console.log('  ⚠  1〜' + CATEGORIES.length + ' の番号を入力してください。');
      }
    }

    // ── 3. スラッグ（=記事ID 16桁） ───────────────────────────
    let slug = '';
    const autoSlugPrompt = await ask(
      rl,
      `📌 記事ID slug（空で自動生成。カテゴリ接頭ルール+16桁数字）: `
    );
    if (!autoSlugPrompt) {
      slug = generateSlugFromCategory(category);
      let guard = 0;
      while (existing.some(a => a.slug === slug)) {
        slug = generateSlugFromCategory(category);
        guard++;
        if (guard > 10) throw new Error('slug collision guard exceeded');
      }
      console.log(`  ✅ 自動生成した slug: ${slug}`);
    } else {
      slug = autoSlugPrompt;
      while (true) {
        if (!isValidSlug(slug)) {
          console.log('  ⚠  形式が正しくありません（英小文字・数字・ハイフンのみ）。');
        } else if (existing.some(a => a.slug === slug)) {
          console.log(`  ⚠  スラッグ "${slug}" はすでに存在します。別のスラッグを指定してください。`);
        } else {
          break;
        }
        slug = await ask(rl, '📌 正しい slug を入力してください: ');
      }
    }

    // ── 4. 公開日 ──────────────────────────────────────────────
    const defaultDate = today();
    let publishedAt = await ask(rl, `📅 公開日（YYYY-MM-DD。省略で ${defaultDate}）: `);
    if (!publishedAt) publishedAt = defaultDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
      console.log('  ⚠  形式が正しくないため今日の日付を使用します。');
      publishedAt = defaultDate;
    }

    // ── 5. ヒーロータイトル ────────────────────────────────────
    let heroTitle = await ask(rl, `✏️  ヒーロータイトル（省略で "${company}の評判を<br>徹底調査しました"）: `);
    if (!heroTitle) heroTitle = `${company}の評判を<br>徹底調査しました`;

    // ── 6. サブコピー ──────────────────────────────────────────
    let heroSub = await ask(rl, `📝 サブコピー（省略でデフォルト）: `);
    if (!heroSub) heroSub = `記者・漆沢が実際の利用者の声をもとに独自取材した、${company}の信頼性の高い評判記事です。`;

    // ── 7. 公式URL ─────────────────────────────────────────────
    let officialUrl = await ask(rl, '🔗 公式サイトURL（省略で "#"）: ');
    if (!officialUrl) officialUrl = '#';

    // ── 記事オブジェクトを構築 ──────────────────────────────────
    const article = {
      ...template,
      slug,
      title:      `${company}の評判を徹底調査しました | みんなの評判.com`,
      metaDesc:   `記者・漆沢が実際の利用者の声をもとに独自取材した、${company}の信頼性の高い評判記事です。`,
      company,
      category,
      publishedAt,
      updatedAt:  publishedAt,
      heroTitle,
      heroSub,
      officialUrl,
      ctaTitle:   `${company}が気になった方へ`,
    };

    // ── 保存 ───────────────────────────────────────────────────
    console.log('\n⏳ data/articles.js に追記中...');
    appendToArticlesJs(article);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 記事を追加しました！');
    console.log(`   スラッグ : ${slug}`);
    console.log(`   企業名   : ${company}`);
    console.log(`   カテゴリ : ${category}`);
    console.log(`   公開日   : ${publishedAt}`);
    console.log('\n📄 記事プレビュー（ローカル）:');
    console.log(`   file://${path.join(ROOT, 'article.html')}?id=${slug}`);
    console.log('\n⚠  レビュー・FAQ・ギャラリー等の詳細データは');
    console.log('   data/articles.js を直接編集するか、');
    console.log('   admin.html から更新してください。');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('❌ エラーが発生しました:', err.message);
  process.exit(1);
});
