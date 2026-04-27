#!/usr/bin/env node
/**
 * ================================================================
 *  みんなの評判.com — RSS 2.0 フィード自動生成スクリプト
 *
 *  _post/ 以下の記事JSを読み込み feed.xml を生成する。
 *  Google Discover / RSS リーダーへの配信に使用。
 *
 *  使い方: node scripts/generate-feed.js
 * ================================================================
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT     = path.resolve(__dirname, '..');
const POST_DIR = path.join(ROOT, '_post');
const FEED_OUT = path.join(ROOT, 'feed.xml');
const BASE_URL = 'https://minnano-hyouban.com';
const NOW_RFC  = new Date().toUTCString();

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
  } catch { return null; }
}

function xmlEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toRfc822(dateStr) {
  if (!dateStr) return NOW_RFC;
  try { return new Date(dateStr).toUTCString(); } catch { return NOW_RFC; }
}

function absImg(u) {
  if (!u) return `${BASE_URL}/images/urushizawa-face-close.jpg`;
  return /^https?:\/\//.test(u) ? u : `${BASE_URL}/${u.replace(/^\//, '')}`;
}

// 記事収集・日付降順ソート
const articles = collectPostFiles(POST_DIR)
  .map(extractArticle)
  .filter(a => a && a.slug)
  .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

const items = articles.map(a => {
  const url   = `${BASE_URL}/article.html?id=${encodeURIComponent(a.slug)}`;
  const title = a.title || `${a.company}の口コミ評判｜みんなの評判.com`;
  const desc  = a.metaDesc || a.summary || '';
  const img   = absImg(a.ogImage);
  const pub   = toRfc822(a.publishedAt);
  const company = (a.company || '').split(/[（(]/)[0].trim();

  return `  <item>
    <title>${xmlEsc(title)}</title>
    <link>${xmlEsc(url)}</link>
    <guid isPermaLink="true">${xmlEsc(url)}</guid>
    <pubDate>${pub}</pubDate>
    <description><![CDATA[${desc}]]></description>
    <author>urushizawa@medikuru.com (漆沢 祐樹)</author>
    <category>${xmlEsc(a.category || '企業評判')}</category>
    <enclosure url="${xmlEsc(img)}" type="image/png" length="0"/>
    <media:content url="${xmlEsc(img)}" medium="image"/>
  </item>`;
}).join('\n\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>みんなの評判.com（みんなの評判ドットコム）</title>
    <link>${BASE_URL}/</link>
    <description>企業・サービスの口コミ評判を第三者記者が直接取材する評判口コミメディア。漆沢祐樹が取材・執筆。</description>
    <language>ja</language>
    <lastBuildDate>${NOW_RFC}</lastBuildDate>
    <managingEditor>urushizawa@medikuru.com (漆沢 祐樹)</managingEditor>
    <webMaster>urushizawa@medikuru.com (漆沢 祐樹)</webMaster>
    <image>
      <url>${BASE_URL}/favicon.png</url>
      <title>みんなの評判.com</title>
      <link>${BASE_URL}/</link>
    </image>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <copyright>© 2026 みんなの評判.com</copyright>
    <ttl>1440</ttl>

${items}

  </channel>
</rss>
`;

fs.writeFileSync(FEED_OUT, xml, 'utf8');
console.log(`✅ feed.xml を生成しました（${articles.length}件）`);
