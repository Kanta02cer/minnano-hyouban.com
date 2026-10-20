'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

function validateHeldReports(root) {
  const holds = JSON.parse(fs.readFileSync(path.join(root, 'content/report-publication-holds.json'), 'utf8'));
  for (const [id, record] of Object.entries(holds.articles)) {
    const html = fs.readFileSync(path.join(root, 'site-v2/reports', id, 'index.html'));
    const sha = createHash('sha256').update(html).digest('hex');
    if (sha !== record.sha256) {
      throw new Error(`${id}: 公開保留中の現物SHAが変わっています。本文生成・公開を止め、最新の公開現物と保全記録を照合してください。`);
    }
  }
}

module.exports = {validateHeldReports};
