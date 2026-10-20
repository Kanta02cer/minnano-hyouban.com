'use strict';

// Public, edited extracts only. Raw recordings and evidence maps live outside Git.
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = value => typeof value === 'string' && value.trim().length > 0 && !/[<>]/.test(value);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const jaDate = value => value.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, '$1年$2月$3日');
const headingText = value => value.split(/(?<=、)/).map(part => Array.from(part).length <= 14 ? `<span class="interview-phrase">${esc(part)}</span>` : esc(part)).join('');
function publicUrl(value) {
  try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password && !/(^|\.)notta\.ai$/.test(u.hostname) && u.hostname !== 'minnano-hyouban.com'; }
  catch { return false; }
}
function validateInterview(entry, id) {
  const fail = message => { throw new Error(`Interview ${id}: ${message}`); };
  if (!entry || entry.kind !== 'provided_record') fail('reviewed provided_record is required');
  const allowed = new Set(['kind','recordDate','interviewee','heading','introduction','sections','company','summary','faqs','relatedInterview']);
  if (Object.keys(entry).some(key => !allowed.has(key))) fail('unexpected public data field');
  for (const key of ['interviewee','heading','introduction','summary']) if (!text(entry[key])) fail(`missing ${key}`);
  if (!date(entry.recordDate)) fail('invalid record date');
  if (!Array.isArray(entry.sections) || entry.sections.length < 3 || entry.sections.length > 5) fail('3–5 reviewed sections are required');
  const keys = new Set();
  for (const section of entry.sections) {
    if (!/^[a-z][a-z0-9-]*$/.test(section.key) || keys.has(section.key)) fail('invalid or duplicate section key');
    keys.add(section.key);
    if (Object.keys(section).some(key => !['key','heading','paragraphs'].includes(key))) fail('unexpected section field');
    if (!text(section.heading) || !Array.isArray(section.paragraphs) || !section.paragraphs.length || !section.paragraphs.every(text)) fail('missing section copy');
  }
  const company = entry.company;
  if (!company || !text(company.name) || !text(company.business) || !publicUrl(company.url) || !text(company.sourceLabel) || !date(company.checkedDate)) fail('verified company information is required');
  if (Object.keys(company).some(key => !['name','representative','address','business','url','sourceLabel','checkedDate'].includes(key))) fail('unexpected company field');
  if (!Array.isArray(entry.faqs) || entry.faqs.length !== 2 || entry.faqs.some(f => !text(f.question) || !text(f.answer))) fail('two interview FAQs are required');
  if (entry.relatedInterview && (!text(entry.relatedInterview.name) || !/^https:\/\/shacho-shuzai\.com\/articles\/\d+\/$/.test(entry.relatedInterview.url))) fail('invalid sister article');
  const serialized = JSON.stringify(entry);
  if (/app\.notta\.ai|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|\/Users\/|recordIds|sourceHashes|access_token/i.test(serialized)) fail('private evidence leaked into public copy');
}
function sourceHref(source) {
  return source.kind === 'interview' ? '#interview-notes' : source.url;
}
function validateInterviewReference(source, entry, id) {
  validateInterview(entry, id);
  if (source.kind !== 'interview' || source.interviewId !== 'interview-notes' || !text(source.label) || Object.keys(source).some(key => !['kind','interviewId','label'].includes(key))) throw new Error(`Interview ${id}: invalid reference`);
}
function interviewCitation(entry, url) {
  return {'@type':'CreativeWork','@id':`${url}#interview-notes`,url:`${url}#interview-notes`,name:entry.heading,description:`${entry.interviewee}の提供された取材記録をもとに編集。記録日：${entry.recordDate}。本記事のための追加取材は行っていません。`};
}
function renderInterview(entry, id) {
  if (!entry) return '';
  validateInterview(entry, id);
  const company = entry.company;
  const facts = [['会社・運営主体',company.name],['代表・責任者',company.representative],['所在地・拠点',company.address],['主な事業',company.business]].filter(([,value]) => text(value));
  return `\n<!-- INTERVIEW_NOTES_START -->
<section class="report-section interview-notes" id="interview-notes" aria-labelledby="interview-notes-heading">
  <p class="section-kicker">INTERVIEW NOTES</p><h2 id="interview-notes-heading">${esc(entry.heading)}</h2>
  <p class="interview-deck">${esc(entry.introduction)}</p>
  <dl class="interview-credit"><div><dt>話を聞いた相手</dt><dd>${esc(entry.interviewee)}</dd></div><div><dt>取材記録の表示日</dt><dd><time datetime="${entry.recordDate}">${jaDate(entry.recordDate)}</time></dd></div></dl>
  <p class="interview-provenance">提供された取材記録から、会社・サービスに関する発言を編集しています。本記事のための追加取材は行っていません。記述は取材当時の説明であり、現在の提供内容・条件は公式窓口で確認できます。</p>
  ${entry.sections.map(section => `<div class="interview-topic" id="interview-${section.key}"><h3>${headingText(section.heading)}</h3>${section.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`).join('\n  ')}
</section>
<section class="report-section company-profile" id="company-profile" aria-labelledby="company-profile-heading">
  <p class="section-kicker">COMPANY PROFILE</p><h2 id="company-profile-heading">会社・サービスの基本情報</h2>
  <dl class="company-facts">${facts.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
  <p class="reader-guide-sources">出典：<a href="${esc(company.url)}">${esc(company.sourceLabel)}</a>（確認：<time datetime="${company.checkedDate}">${jaDate(company.checkedDate)}</time>）</p>
  ${entry.relatedInterview ? `<p class="sister-interview-link">経歴や仕事への考え方は、姉妹メディア「社長の取材.com」の<a href="${esc(entry.relatedInterview.url)}">${esc(entry.relatedInterview.name)}の人物記事</a>でも紹介しています。</p>` : ''}
</section>
<!-- INTERVIEW_NOTES_END -->\n`.replace(/[\t ]+$/gm, '');
}
module.exports = {validateInterview,validateInterviewReference,sourceHref,interviewCitation,renderInterview};
