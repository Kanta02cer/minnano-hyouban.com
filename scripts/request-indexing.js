#!/usr/bin/env node
/**
 * ================================================================
 *  みんなの評判.com — インデックス促進ガイドスクリプト
 *
 *  Google/Bing の公開 ping エンドポイントは2023年に廃止済み。
 *  現在の正規手順は Search Console での手動リクエスト。
 *
 *  使い方: node scripts/request-indexing.js
 *  → 手順と URL 一覧を出力する
 * ================================================================
 */
'use strict';

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const POST_DIR = path.join(ROOT, '_post');
const BASE_URL = 'https://minnano-hyouban.com';

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

function extractSlug(filePath) {
  try {
    const src = fs.readFileSync(filePath, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { timeout: 3000 });
    const key = Object.keys(sandbox.window).find(k => k.startsWith('__POST_'));
    return key ? sandbox.window[key]?.slug : null;
  } catch { return null; }
}

const slugs = collectPostFiles(POST_DIR).map(extractSlug).filter(Boolean);
const urls  = slugs.map(s => `${BASE_URL}/article.html?id=${s}`);

console.log(`
====================================================
  みんなの評判.com — Search Console インデックス促進
====================================================

【手順】
1. https://search.google.com/search-console/ を開く
2. 左メニュー「URL検査」をクリック
3. 以下のURLを1件ずつ入力 → 「インデックス登録リクエスト」

【対象URL (${urls.length}件)】
`);
urls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));

console.log(`
【サイトマップ確認】
  Search Console → サイトマップ → 以下を送信済みか確認
  ${BASE_URL}/sitemap.xml

【Bing Webmaster Tools も実施すると◎】
  https://www.bing.com/webmasters/
  → サイトマップ → ${BASE_URL}/sitemap.xml を送信

====================================================
`);
