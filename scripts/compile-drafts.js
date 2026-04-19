#!/usr/bin/env node
/**
 * みんなの評判.com — _drafts → data/articles.js
 *
 * - _drafts/*.md を読み込む
 * - status: publish のものだけ対象
 * - 手書きメインコンテンツをAIで article-template.json 形式へ構造化
 * - 生成した記事を data/articles.js の window.ARTICLES に反映
 *
 * 必要な環境変数:
 * - OPENAI_API_KEY（AI構造化に使用）
 * - OPENAI_MODEL（任意。デフォルト: gpt-4o-mini）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DRAFTS_DIR = path.join(ROOT, '_drafts');
const TEMPLATE_JSON = path.join(ROOT, 'docs', 'article-template.json');
const ARTICLES_JS = path.join(ROOT, 'data', 'articles.js');

const { generateSlugFromCategory } = require('./id-from-category');

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function parseFrontMatter(md) {
  // YAML front matter: ---\nkey: value\n---\n...
  if (!md.startsWith('---')) return { fm: {}, body: md };
  const endIdx = md.indexOf('\n---', 3);
  if (endIdx === -1) return { fm: {}, body: md };
  const fmRaw = md.slice(3, endIdx).trim(); // exclude first '---'
  const body = md.slice(endIdx + 4); // skip '\n---'

  const fm = {};
  for (const line of fmRaw.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    // Strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return { fm, body };
}

function loadArticles() {
  if (!fs.existsSync(ARTICLES_JS)) return [];
  const content = fs.readFileSync(ARTICLES_JS, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(content, sandbox);
  return Array.isArray(sandbox.window?.ARTICLES) ? sandbox.window.ARTICLES : [];
}

function writeArticles(articles) {
  const json = JSON.stringify(articles, null, 2);
  const existing = fs.existsSync(ARTICLES_JS) ? fs.readFileSync(ARTICLES_JS, 'utf8') : '';
  const start = existing.indexOf('window.ARTICLES =');
  if (start === -1) {
    const header = `window.ARTICLES = ${json};\n`;
    fs.writeFileSync(ARTICLES_JS, header, 'utf8');
    return;
  }

  const head = existing.slice(0, start).trimEnd();
  const out = `${head}\n\nwindow.ARTICLES = ${json};\n`;
  fs.writeFileSync(ARTICLES_JS, out, 'utf8');
}

function loadTemplate() {
  return JSON.parse(fs.readFileSync(TEMPLATE_JSON, 'utf8'));
}

function categoryOrderDigitExpectedPrefix(category) {
  // generateSlugFromCategory uses digit repeated n times; replicate by calling with rem zeros is overkill.
  // We'll derive from the exported function by creating prefix from index.
  // Here: prefix = digit(n) repeated n.
  const { CATEGORIES, categoryIndex } = require('./id-from-category');
  const n = categoryIndex(category);
  const digit = String(n);
  return digit.repeat(n);
}

async function callOpenAIForArticle({ systemPrompt, userPrompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY が未設定です。');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText} ${text}`.trim());
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI: no content returned.');

  return content;
}

function safeNumber(n, { fallback = 4, min = 0, max = 5 } = {}) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function clampStars(stars) {
  const v = Number(stars);
  if (!Number.isFinite(v)) return 4;
  const iv = Math.round(v);
  return Math.min(5, Math.max(1, iv));
}

function normalizeArticleFromAI(aiObj, { slug, company, category, publishedAt, officialUrl, template }) {
  // Start from template to ensure required structure exists.
  const out = { ...template, ...aiObj };

  // Force required identity fields.
  out.slug = slug;
  out.company = company;
  out.category = category;
  out.publishedAt = publishedAt;
  out.updatedAt = publishedAt;
  out.officialUrl = officialUrl || '#';

  // Ensure heroTitle exists (required by validate script).
  if (!out.heroTitle) out.heroTitle = `${company}の評判を<br>徹底調査しました`;
  if (!out.title) out.title = `${company}の評判を徹底調査しました | みんなの評判.com`;
  if (!out.metaDesc) {
    out.metaDesc = `記者・漆沢が実際の利用者の声をもとに独自取材した、${company}の信頼性の高い評判記事です。`;
  }
  if (!out.ctaBtn) out.ctaBtn = '公式サイトを確認する →';
  if (!out.ctaTitle) out.ctaTitle = `${company}が気になった方へ`;
  if (!out.ctaSub) out.ctaSub = 'まずは公式サイトで詳細をご確認ください。';

  // Normalize galleries to placeholder if missing.
  out.galleries = out.galleries || template.galleries;
  out.galleries.service = Array.isArray(out.galleries.service) && out.galleries.service.length ? out.galleries.service : template.galleries.service;
  out.galleries.beforeAfter = Array.isArray(out.galleries.beforeAfter) && out.galleries.beforeAfter.length ? out.galleries.beforeAfter : template.galleries.beforeAfter;
  out.galleries.media = Array.isArray(out.galleries.media) && out.galleries.media.length ? out.galleries.media : template.galleries.media;

  // Normalize reviews
  out.reviews = Array.isArray(out.reviews) && out.reviews.length ? out.reviews : template.reviews;
  out.reviews = out.reviews.slice(0, 5).map(r => ({
    ...r,
    id: Number(r.id ?? 1),
    name: String(r.name || '取材協力者'),
    age: String(r.age || ''),
    stars: clampStars(r.stars),
    tag: String(r.tag || ''),
    text: String(r.text || ''),
  }));

  // Normalize interviews
  out.interviews = Array.isArray(out.interviews) && out.interviews.length ? out.interviews : template.interviews;
  out.interviews = out.interviews.slice(0, 3).map(iv => ({
    name: String(iv.name || '取材協力者'),
    bg: String(iv.bg || ''),
    resultType: String(iv.resultType || 'success'),
    resultLabel: String(iv.resultLabel || ''),
    qa: Array.isArray(iv.qa) ? iv.qa.slice(0, 2).map(q => ({ q: String(q.q || ''), a: String(q.a || '') })) : [],
    obs: String(iv.obs || ''),
  }));
  if (out.interviews.length < 3) {
    // Fill remaining with template interviews if missing.
    while (out.interviews.length < 3) out.interviews.push(template.interviews[out.interviews.length]);
  }

  // Normalize scoreDetails
  out.scoreDetails = Array.isArray(out.scoreDetails) && out.scoreDetails.length ? out.scoreDetails : template.scoreDetails;
  out.scoreDetails = out.scoreDetails.slice(0, 5).map(s => ({
    label: String(s.label || ''),
    score: safeNumber(s.score, { fallback: 4, min: 0, max: 5 }),
    max: safeNumber(s.max, { fallback: 5, min: 1, max: 10 }),
  }));

  // Normalize faqs
  out.faqs = Array.isArray(out.faqs) && out.faqs.length ? out.faqs : template.faqs;
  out.faqs = out.faqs.slice(0, 10).map(f => ({
    q: String(f.q || ''),
    a: String(f.a || ''),
  }));

  // Normalize cuttingSummary
  if (!out.cuttingSummary || typeof out.cuttingSummary !== 'object') {
    out.cuttingSummary = template.cuttingSummary;
  }

  return out;
}

function buildAIUserPrompt({ frontMatter, body, slug }) {
  // Use only user-provided body for content; other fields derived from front matter + stable rules.
  return [
    `front matter (入力情報):`,
    JSON.stringify(frontMatter, null, 2),
    ``,
    `generated slug (記事IDとして使用):`,
    JSON.stringify({ slug }, null, 2),
    ``,
    `メインコンテンツ（手書き本文。ここから構造化して下さい）:`,
    body.trim(),
    ``,
    `出力要件:`,
    `- article-template.json と同じフィールド構造の JSON オブジェクトを出力`,
    `- 文字列は日本語でOK`,
    `- reviews は 5件、interviews は 3件、scoreDetails は 5件、faqs は5〜8問程度、featureBoxes は4件、serviceCards は4件、steps は3件を作る`,
    `- 指定の事実が本文にない場合は「未確定（要確認）」のようにして捏造しない`,
    `- officialUrl, company, category, publishedAt, slug は入力に合わせる（変更しない）`,
  ].join('\n');
}

async function main() {
  const template = loadTemplate();
  const existingArticles = loadArticles();

  const drafts = fs.existsSync(DRAFTS_DIR)
    ? fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md')).map(f => path.join(DRAFTS_DIR, f))
    : [];

  const publishDrafts = [];
  for (const file of drafts) {
    const md = fs.readFileSync(file, 'utf8');
    const { fm } = parseFrontMatter(md);
    if (String(fm.status || '').toLowerCase() === 'publish') publishDrafts.push({ file, fm, md });
  }

  if (publishDrafts.length === 0) {
    console.log('publish ドラフトがありません。data/articles.js を更新せず終了。');
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(`publish ドラフトが ${publishDrafts.length} 件ありますが、OPENAI_API_KEY が未設定です。`);
  }

  const usedSlugs = new Set(existingArticles.map(a => String(a.slug)));

  for (const d of publishDrafts) {
    const mdText = fs.readFileSync(d.file, 'utf8');
    const parsed = parseFrontMatter(mdText);
    const fm = parsed.fm;
    const body = parsed.body;

    const company = String(fm.company || '').trim();
    const category = String(fm.category || '').trim();
    const publishedAt = String(fm.publishedAt || '').trim();
    const officialUrl = String(fm.officialUrl || '#').trim() || '#';

    if (!company) throw new Error(`${d.file}: company が必要です`);
    if (!category) throw new Error(`${d.file}: category が必要です`);
    if (!publishedAt || !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
      throw new Error(`${d.file}: publishedAt は YYYY-MM-DD が必要です`);
    }

    // Generate 16-digit slug from category scheme, unique within repo.
    let slug = generateSlugFromCategory(category);
    let guard = 0;
    while (usedSlugs.has(slug)) {
      slug = generateSlugFromCategory(category);
      guard++;
      if (guard > 10) throw new Error('slug collision guard exceeded');
    }
    usedSlugs.add(slug);

    const systemPrompt = [
      'あなたは記事生成のための「構造化JSON変換」担当です。',
      'ユーザーが提供したメインコンテンツを、記事テンプレ（article-template.json）に合うように整理してください。',
      '重要: 事実を捏造しない。本文に情報がない項目は「未確定（要確認）」等で埋める。',
      '出力は必ず有効なJSONのみ（先頭/末尾に ``` を付けない）。',
    ].join(' ');

    const userPrompt = buildAIUserPrompt({
      frontMatter: fm,
      body,
      slug,
    });

    console.log(`AI変換中: ${path.basename(d.file)} -> slug=${slug}`);
    const aiText = await callOpenAIForArticle({ systemPrompt, userPrompt });

    let aiObj;
    try {
      aiObj = JSON.parse(aiText);
    } catch (e) {
      // Sometimes model wraps with text; try to extract JSON.
      const m = aiText.match(/\{[\s\S]*\}/);
      if (!m) throw new Error(`AI JSON parse failed for ${d.file}`);
      aiObj = JSON.parse(m[0]);
    }

    const normalized = normalizeArticleFromAI(aiObj, {
      slug,
      company,
      category,
      publishedAt,
      officialUrl,
      template,
    });

    // Reflect into existingArticles by slug.
    const idx = existingArticles.findIndex(a => String(a.slug) === slug);
    if (idx >= 0) existingArticles[idx] = normalized;
    else existingArticles.push(normalized);
  }

  writeArticles(existingArticles);
  console.log(`完成: data/articles.js updated. total=${existingArticles.length}`);
}

main().catch(err => {
  console.error('❌ compile-drafts failed:', err && err.message ? err.message : err);
  process.exit(1);
});

