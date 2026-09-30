'use strict';

// Editorial copy is reviewed in JSON; these checks catch missing answers and
// unsafe/missing references before any public HTML is replaced.
function validateGuide(guide, id) {
  const fail = message => { throw new Error(`Reader guide ${id}: ${message}`); };
  const text = value => typeof value === 'string' && value.trim().length > 0 && !/[<>]/.test(value);
  if (!guide || !Array.isArray(guide.summary) || guide.summary.length !== 2) fail('two summary paragraphs are required');
  if (!Array.isArray(guide.faqs) || guide.faqs.length < 8 || guide.faqs.length > 12) fail('8–12 substantive FAQs are required');
  const questions = new Set();
  const answers = new Set();
  for (const [index, item] of [...guide.summary, ...guide.faqs].entries()) {
    if (!text(item?.text ?? item?.answer)) fail(`item ${index + 1} needs plain-text copy`);
    if (index >= 2) {
      if (!text(item.question)) fail(`FAQ ${index - 1} needs a question`);
      if (questions.has(item.question.trim()) || answers.has(item.answer.trim())) fail('duplicate question or answer');
      questions.add(item.question.trim()); answers.add(item.answer.trim());
    }
    if (!Array.isArray(item.sources) || !item.sources.length) fail(`item ${index + 1} needs evidence`);
    let external = false;
    for (const source of item.sources) {
      if (!text(source.label) || !text(source.url)) fail('source label and URL are required');
      const internal = /^\/reports\/[a-z0-9-]+\/$/.test(source.url);
      let url;
      try { url = new URL(source.url, 'https://minnano-hyouban.com'); } catch { fail('invalid source URL'); }
      if (!internal && (url.protocol !== 'https:' && url.protocol !== 'http:')) fail('invalid source protocol');
      if (!internal && (url.hostname === 'minnano-hyouban.com' || url.username || url.password)) fail('use a public external source');
      external ||= !internal;
    }
    if (!external) fail('each response needs at least one external reference');
  }
}

const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const references = sources => `<p class="reader-guide-sources">出典：${sources.map(source => `<a href="${esc(source.url)}">${esc(source.label)}</a>`).join(' / ')}</p>`;

function renderGuide(guide, subjectLabel) {
  return `
<!-- READER_GUIDE_START -->
<section class="report-section report-summary" id="report-summary" aria-labelledby="report-summary-heading">
  <p class="section-kicker">SUMMARY</p><h2 id="report-summary-heading">${esc(subjectLabel)}のまとめ</h2>
  ${guide.summary.map(item => `<div class="summary-paragraph"><p>${esc(item.text)}</p>${references(item.sources)}</div>`).join('\n  ')}
</section>
<section class="report-section report-faq" id="report-faq" aria-labelledby="report-faq-heading">
  <p class="section-kicker">QUESTIONS &amp; ANSWERS</p><h2 id="report-faq-heading">${esc(subjectLabel)}のよくある質問</h2>
  <div class="faq-toolbar"><p>知りたい質問を選ぶと、回答と出典を確認できます。</p><button type="button" class="faq-toggle-all" aria-controls="report-faq-list" aria-expanded="false" hidden>すべての回答を開く</button></div>
  <div class="faq-list" id="report-faq-list">
  ${guide.faqs.map((item, index) => `<details class="faq-item" id="faq-${String(index + 1).padStart(2, '0')}"${index === 0 ? ' open' : ''}><summary><span class="faq-number" aria-hidden="true">Q${String(index + 1).padStart(2, '0')}</span><span class="faq-question">${esc(item.question)}</span><span class="faq-icon" aria-hidden="true"></span></summary><div class="faq-answer"><p>${esc(item.answer)}</p>${references(item.sources)}</div></details>`).join('\n  ')}
  </div>
</section>
<!-- READER_GUIDE_END -->
`;
}

module.exports = {validateGuide, renderGuide};
