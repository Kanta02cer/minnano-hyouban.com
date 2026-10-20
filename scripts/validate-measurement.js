'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ASSETS = ['media-clicks.js','media-analytics-bootstrap.js','media-analytics-entry.js','media-consent.css'];
const decode = s => s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
function validateMeasurement(sourceDir, ids) {
  for (const asset of ASSETS) if (!fs.existsSync(path.join(sourceDir, asset))) throw new Error(`計測asset不足: ${asset}`);
  for (const id of ids) {
    const html = fs.readFileSync(path.join(sourceDir,'reports',id,'index.html'),'utf8');
    const blocks = [...html.matchAll(/<script id="media-analytics-config" type="application\/json">([\s\S]*?)<\/script>/g)];
    if (blocks.length !== 1) throw new Error(`${id}: 計測設定が欠落・重複。台帳と原稿を再照合してください。`);
    const c = JSON.parse(blocks[0][1]);
    if (c.mediaId !== 'minnano_hyouban' || c.articleId !== id || c.measurementId !== 'G-YBRSKWW8VE' || c.enabled !== true || c.verification?.streamConfirmed !== true || c.verification?.enhancedMeasurementDisabled !== true || c.verification?.privacyUpdated !== true) throw new Error(`${id}: 計測受信先・設定が未確認`);
    if (!html.includes('href="/media-consent.css"') || !html.includes('type="module" src="/media-analytics-entry.js"')) throw new Error(`${id}: bootstrapが欠落`);
    const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map(m => {
      const attrs=Object.fromEntries([...m[0].matchAll(/([a-zA-Z][a-zA-Z0-9_-]*)=("([^"]*)"|'([^']*)')/g)].map(x=>[x[1],decode(x[3] ?? x[4])]));
      return attrs;
    }).filter(a=>a['data-mm-link']);
    if (!Array.isArray(c.links) || !c.links.length || anchors.length !== c.links.length || new Set(anchors.map(a=>a['data-mm-link'])).size !== anchors.length) throw new Error(`${id}: 計測リンク数・IDが台帳と不一致`);
    for (const link of c.links) {
      const a=anchors.find(a=>a['data-mm-link']===link.id);
      if (!a || a.href !== link.href || link.verified !== true) throw new Error(`${id}/${link.id}: 公開URL・計測台帳を再照合してください`);
    }
  }
}
module.exports = { validateMeasurement };
