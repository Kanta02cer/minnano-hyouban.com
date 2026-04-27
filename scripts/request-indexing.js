#!/usr/bin/env node
/**
 * ================================================================
 *  みんなの評判.com — Google インデックス促進スクリプト
 *
 *  以下の2つを実行する：
 *  1. Google に sitemap.xml を ping して再クロールを促す
 *  2. Bing に sitemap.xml を ping（Bing 経由流入も見込む）
 *
 *  使い方: node scripts/request-indexing.js
 *
 *  ※ Google Search Console API（OAuth）は不要。
 *     公開 ping エンドポイントを使用。
 *  ※ 新記事追加後・大きな変更後に実行してください。
 * ================================================================
 */
'use strict';

const https = require('https');

const SITEMAP_URL = encodeURIComponent('https://minnano-hyouban.com/sitemap.xml');

const PINGS = [
  {
    label: 'Google Sitemap ping',
    url: `https://www.google.com/ping?sitemap=${SITEMAP_URL}`
  },
  {
    label: 'Bing Sitemap ping',
    url: `https://www.bing.com/ping?sitemap=${SITEMAP_URL}`
  }
];

function ping(label, url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      console.log(`  ${res.statusCode < 300 ? '✅' : '⚠️ '} ${label}: HTTP ${res.statusCode}`);
      resolve();
    }).on('error', (err) => {
      console.log(`  ❌ ${label}: ${err.message}`);
      resolve();
    });
  });
}

(async () => {
  console.log('\n📡 サイトマップを検索エンジンに送信中...\n');
  for (const p of PINGS) {
    await ping(p.label, p.url);
  }
  console.log('\n✅ 完了。Search Console で「URL検査」→「インデックス登録リクエスト」も個別に実行すると効果的です。');
  console.log('\n📋 個別記事URL一覧（Search Console でのURL検査用）:');
  const slugs = [
    '1794482170414453',
    '2221437250750372',
    '2252563132716439',
    '3340006759735454'
  ];
  slugs.forEach(s => console.log(`  https://minnano-hyouban.com/article.html?id=${s}`));
})();
