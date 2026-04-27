#!/usr/bin/env node
/**
 * ================================================================
 *  みんなの評判.com — WebP 一括変換スクリプト
 *
 *  _post/ 以下の .jpg / .jpeg / .png を WebP に変換する。
 *  既に .webp が存在する場合はスキップ（--force で上書き可）。
 *  macOS 標準の sips コマンドを使用（追加インストール不要）。
 *
 *  使い方:
 *    node scripts/convert-webp.js          # 新規のみ変換
 *    node scripts/convert-webp.js --force  # 全て上書き変換
 * ================================================================
 */
'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const POST_DIR = path.join(ROOT, '_post');
const FORCE    = process.argv.includes('--force');
const EXTS     = new Set(['.jpg', '.jpeg', '.png']);

function collectImages(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectImages(full));
    else if (EXTS.has(path.extname(entry.name).toLowerCase())) results.push(full);
  }
  return results;
}

const images = collectImages(POST_DIR);
let converted = 0, skipped = 0, failed = 0;

for (const src of images) {
  const webpPath = src.replace(/\.[^.]+$/, '.webp');
  if (!FORCE && fs.existsSync(webpPath)) {
    skipped++;
    continue;
  }
  try {
    // cwebp: 高品質 WebP 変換（quality 82）
    execSync(`cwebp -q 82 ${JSON.stringify(src)} -o ${JSON.stringify(webpPath)}`, {
      stdio: 'pipe'
    });
    const origSize = fs.statSync(src).size;
    const webpSize = fs.statSync(webpPath).size;
    const saved = Math.round((1 - webpSize / origSize) * 100);
    console.log(`✅ ${path.relative(ROOT, src)} → .webp (${saved}% 削減)`);
    converted++;
  } catch (e) {
    console.error(`❌ 変換失敗: ${path.relative(ROOT, src)}: ${e.message}`);
    failed++;
  }
}

console.log(`\n変換完了: ${converted}件変換 / ${skipped}件スキップ / ${failed}件失敗`);
if (converted > 0) {
  console.log('\n次のステップ: git add _post/ && git commit -m "assets: WebP画像を追加"');
}
