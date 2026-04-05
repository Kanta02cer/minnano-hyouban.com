/**
 * みんなの評判.com — 記事ID（16桁）生成
 *
 * スキーム（暫定）:
 * - カテゴリ順インデックス n(1..5) を決める
 * - 接頭辞 prefix = digit(n) を n回繰り返す（例: n=1 => "1", n=2 => "22", n=5 => "55555"）
 * - 残り桁を 0-9 からランダムで埋め、合計16桁にする
 */
'use strict';

const crypto = require('crypto');

const CATEGORIES = [
  'キャリア・転職',
  '美容・健康',
  '語学・スキル',
  'マネー・投資',
  'ライフスタイル',
];

function categoryIndex(category) {
  return CATEGORIES.indexOf(category) + 1; // 0 => not found
}

function randomDigits(count) {
  if (count <= 0) return '';
  const buf = crypto.randomBytes(count);
  return Array.from(buf, b => String(b % 10)).join('');
}

function generateSlugFromCategory(category, { totalLen = 16 } = {}) {
  const n = categoryIndex(category);
  if (!n) throw new Error(`Unknown category: "${category}"`);

  const digit = String(n);
  const prefix = digit.repeat(n);
  const rem = totalLen - prefix.length;
  if (rem < 0) throw new Error(`Invalid ID scheme: totalLen=${totalLen}, prefixLen=${prefix.length}`);
  return prefix + randomDigits(rem);
}

module.exports = {
  CATEGORIES,
  categoryIndex,
  generateSlugFromCategory,
};

