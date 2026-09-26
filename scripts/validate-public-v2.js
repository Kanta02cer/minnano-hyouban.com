#!/usr/bin/env node
'use strict';

// Source-level checks for each public report. Run before npm run build.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const problems = [];
const requiredWords = ['口コミ', '評判', '実績'];

function check(condition, message) {
  if (!condition) problems.push(message);
}

function contentOf(html, pattern) {
  return html.match(pattern)?.[1] || '';
}

function plainText(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|amp|lt|gt);/g, ' ').replace(/\s+/g, ' ').trim();
}

const buildSource = read('scripts/build-public-v2.js');
const idsDefinition = contentOf(buildSource, /const reportIds\s*=\s*\[([^\]]*)\]/);
if (!idsDefinition) {
  console.error('検証失敗: build-public-v2.js の reportIds を読み取れません。');
  process.exit(1);
}
const reportIds = [...idsDefinition.matchAll(/['"]([a-z0-9-]+)['"]/g)].map(match => match[1]);
check(reportIds.length > 0, 'reportIds が空です。');
check(reportIds.length === new Set(reportIds).size, 'reportIds に重複があります。');

const actualIds = fs.readdirSync(path.join(root, 'site-v2/reports'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, 'site-v2/reports', entry.name, 'index.html')))
  .map(entry => entry.name);
for (const id of actualIds) check(reportIds.includes(id), `reports/${id}/ が公開 allowlist にありません。`);

const home = read('site-v2/index.html');
const archive = read('site-v2/articles.html');
for (const id of reportIds) {
  const file = `site-v2/reports/${id}/index.html`;
  if (!fs.existsSync(path.join(root, file))) {
    problems.push(`${file} がありません。`);
    continue;
  }
  const html = read(file);
  const canonicalUrl = `https://minnano-hyouban.com/reports/${id}/`;
  const title = contentOf(html, /<title>([\s\S]*?)<\/title>/i);
  const ogTitle = contentOf(html, /<meta\s+property="og:title"\s+content="([^"]*)"/i);
  const h1 = plainText(contentOf(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i));
  const jsonText = contentOf(html, /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  let article = {};
  try { article = JSON.parse(jsonText); } catch { problems.push(`${file}: Article JSON-LD を解析できません。`); }
  for (const [field, value] of [['title', title], ['og:title', ogTitle], ['h1', h1], ['JSON-LD headline', article.headline || '']]) {
    check(requiredWords.every(word => value.includes(word)), `${file}: ${field} に「口コミ・評判・実績」が揃っていません。`);
  }
  check(article['@type'] === 'Article', `${file}: JSON-LD の @type が Article ではありません。`);
  check(html.includes(`<link rel="canonical" href="${canonicalUrl}">`), `${file}: canonical URL が一致しません。`);
  check(html.includes(`<meta property="og:url" content="${canonicalUrl}">`), `${file}: OG URL が一致しません。`);
  check(article.mainEntityOfPage === canonicalUrl, `${file}: JSON-LD の URL が一致しません。`);
  check(html.includes('official-visit'), `${file}: 公式サイトへの案内セクションを確認してください。`);
  check(home.includes(`/reports/${id}/`), `${file}: トップの記事導線がありません。`);
  check(archive.includes(`/reports/${id}/`), `${file}: 記事一覧の導線がありません。`);
}

if (problems.length) {
  for (const problem of problems) console.error(`- ${problem}`);
  console.error(`検証失敗: ${problems.length} 件`);
  process.exitCode = 1;
} else {
  console.log(`調査記事 ${reportIds.length} 件のタイトル・URL・一覧導線を確認しました。`);
}
