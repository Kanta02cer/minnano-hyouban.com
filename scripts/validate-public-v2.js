#!/usr/bin/env node
'use strict';

// Source-level checks for each public report. Run before npm run build.
const fs = require('node:fs');
const path = require('node:path');
const {validateGuide} = require('./lib/report-reader-guide');

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

function decodeText(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()];
    const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
  });
}

function plainText(html) {
  return decodeText(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

const compact = value => value.replace(/\s+/g, '');
const sameText = (a, b) => compact(a || '') === compact(b || '');
const containsText = (html, text) => !!text && compact(plainText(html)).includes(compact(text));

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)]
    .map(([, name, , value]) => [name.toLowerCase(), decodeText(value)]));
}

function metaValue(html, field, value) {
  const tag = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(match => attributes(match[0])).find(attrs => attrs[field] === value);
  return tag?.content || '';
}

function externalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && url.hostname !== 'minnano-hyouban.com';
  } catch { return false; }
}

function isoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === value.slice(0, 10);
}

function graphNodes(data) {
  return Array.isArray(data) ? data.flatMap(graphNodes) : data?.['@graph'] ? data['@graph'].flatMap(graphNodes) : [data];
}

function hasType(node, type) {
  return (Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']]).includes(type);
}

function containsEvaluationSchema(value) {
  if (!value || typeof value !== 'object') return false;
  if (hasType(value, 'AggregateRating') || hasType(value, 'Review')) return true;
  return Object.entries(value).some(([key, child]) => ['aggregateRating', 'review'].includes(key) || containsEvaluationSchema(child));
}

function checkIndexable(html, file) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (/^(robots|googlebot|bingbot|oai-searchbot)$/i.test(attrs.name || '')) {
      check(!/(?:^|[,\s])(?:noindex|none|nosnippet)(?:$|[,\s])|max-snippet\s*:\s*0\b/i.test(attrs.content || ''),
        `${file}: 公開ページのクロール・引用を妨げる robots 指定があります。`);
    }
  }
}

const briefs = {};
for (const file of ['content/search-briefs-bulk.json', 'content/search-briefs-original.json']) {
  try {
    const data = JSON.parse(read(file));
    for (const [id, brief] of Object.entries(data)) {
      check(!briefs[id], `${file}: 検索要約 ${id} が重複しています。`);
      briefs[id] = brief;
    }
  } catch (error) { problems.push(`${file}: 検索要約を読み取れません (${error.message})。`); }
}
const coverage = {};
let readerGuides = {};
try { readerGuides = JSON.parse(read('content/report-reader-guides.json')); }
catch (error) { problems.push(`まとめ・FAQデータを読み取れません (${error.message})。`); }
try {
  const bulk = JSON.parse(read('content/bulk-report-sources.json'));
  for (const item of bulk) {
    check(!coverage[item.id], `掲載媒体情報 ${item.id} が重複しています。`);
    coverage[item.id] = { title: item.newsTitle, date: item.newsDate, media: item.media, type: item.coverageType };
  }
  for (const [id, item] of Object.entries(JSON.parse(read('content/original-report-coverage.json')))) {
    check(!coverage[id], `掲載媒体情報 ${id} が重複しています。`);
    coverage[id] = item;
  }
} catch (error) { problems.push(`掲載媒体情報を読み取れません (${error.message})。`); }

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
for (const file of ['index.html', 'articles.html', 'guide.html', 'editor.html', 'privacy.html', 'disclaimer.html']) {
  checkIndexable(read(`site-v2/${file}`), `site-v2/${file}`);
}
for (const id of Object.keys(briefs)) check(reportIds.includes(id), `検索要約 ${id} の公開記事がありません。`);
for (const id of Object.keys(coverage)) check(reportIds.includes(id), `掲載媒体情報 ${id} の公開記事がありません。`);
for (const id of Object.keys(readerGuides)) check(reportIds.includes(id), `まとめ・FAQ ${id} の公開記事がありません。`);
for (const id of reportIds) {
  const file = `site-v2/reports/${id}/index.html`;
  if (!fs.existsSync(path.join(root, file))) {
    problems.push(`${file} がありません。`);
    continue;
  }
  const html = read(file);
  if (id === '11607') {
    const relationship = contentOf(html, /<section\b[^>]*\bid="editorial-relationship"[^>]*>([\s\S]*?)<\/section>/i);
    const relationshipText = compact(plainText(relationship));
    check(['編集責任者', '漆沢祐樹', 'メディくる', '代表取締役'].every(word => relationshipText.includes(word)),
      `${file}: 編集責任者と紹介企業の関係を editorial-relationship セクションで明記してください。`);
    check(!/\b(?:hidden|aria-hidden\s*=\s*["']true["'])/i.test(relationship)
      && !/<section\b[^>]*\bid="editorial-relationship"[^>]*\b(?:hidden|aria-hidden)/i.test(html),
      `${file}: 編集責任者との関係欄を非表示にしないでください。`);
    check(home.includes('/reports/11607/'), `${file}: 依頼されたサービス記事のトップページ導線がありません。`);
  }
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
  checkIndexable(html, file);
  const guide = readerGuides[id];
  try { validateGuide(guide, id); }
  catch (error) { problems.push(`${file}: ${error.message}`); }
  if (guide?.summary && guide?.faqs) {
    const sections = [...html.matchAll(/<!-- READER_GUIDE_START -->([\s\S]*?)<!-- READER_GUIDE_END -->/g)];
    check(sections.length === 1, `${file}: まとめ・FAQの表示領域は1つ必要です。`);
    const rendered = sections[0]?.[1] || '';
    const summary = contentOf(rendered, /<section\b[^>]*id="report-summary"[^>]*>([\s\S]*?)<\/section>/);
    const faq = contentOf(rendered, /<section\b[^>]*id="report-faq"[^>]*>([\s\S]*?)<\/section>/);
    check(!!summary && !!faq, `${file}: まとめとFAQの静的HTMLが必要です。`);
    const faqItems = [...faq.matchAll(/<details\b[^>]*class="faq-item"[^>]*>([\s\S]*?)<\/details>/g)];
    check(faqItems.length === guide.faqs.length, `${file}: FAQの表示数が編集データと一致しません。`);
    for (const [index, item] of [...guide.summary, ...guide.faqs].entries()) {
      const body = index < 2 ? summary : faqItems[index - 2]?.[1] || '';
      check(containsText(body, item.text ?? item.answer), `${file}: まとめ・FAQ ${index + 1} の本文が編集データと一致しません。`);
      if (index >= 2) check(containsText(contentOf(body, /<summary>([\s\S]*?)<\/summary>/), item.question), `${file}: FAQの質問が一致しません。`);
      const anchors = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
        .map(([, attrs, text]) => ({...attributes(attrs), label: plainText(text)}));
      for (const source of item.sources || []) {
        check(anchors.some(anchor => anchor.href === source.url && sameText(anchor.label, source.label)), `${file}: 回答の出典リンクが一致しません (${source.label})。`);
        if (externalUrl(source.url)) check(article.citation?.includes(source.url), `${file}: まとめ・FAQの出典が Article.citation にありません。`);
        else check(reportIds.some(other => source.url === `/reports/${other}/`), `${file}: FAQの関連記事リンクが公開記事と一致しません。`);
      }
    }
    check(html.includes('href="#report-summary"') && html.includes('href="#report-faq"'), `${file}: まとめ・FAQへの目次リンクがありません。`);
    check(!/<(?:section|div)\b[^>]*(?:id="report-(?:summary|faq)"[^>]*\bhidden|aria-hidden="true")/.test(rendered), `${file}: 回答領域を非表示にしないでください。`);
  }
  const elementIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  check(new Set(elementIds).size === elementIds.length, `${file}: HTMLのidが重複しています。`);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) check(elementIds.includes(match[1]), `${file}: 記事内リンク #${match[1]} の移動先がありません。`);
  const brief = briefs[id];
  const mediaRecord = coverage[id];
  check(!!brief, `${file}: 記事別の検索要約がありません。`);
  check(!!mediaRecord, `${file}: 記事別の掲載媒体情報がありません。`);
  if (brief) {
    const markedBrief = contentOf(html, /<!-- SEARCH_BRIEF_START -->([\s\S]*?)<!-- SEARCH_BRIEF_END -->/);
    check(!!markedBrief && /\bid=["']research-brief["']/.test(markedBrief), `${file}: 読者に表示する検索要約がありません。`);
    const briefSection = [...markedBrief.matchAll(/<section\b[^>]*>/gi)].map(match => match[0])
      .find(tag => attributes(tag).id === 'research-brief') || '';
    check(!/(?:\s|^)hidden(?:\s|=|>)|aria-hidden=["']true["']|display\s*:\s*none|visibility\s*:\s*hidden/i.test(briefSection), `${file}: 検索要約が非表示になっています。`);
    check(containsText(markedBrief, brief.introduction), `${file}: 要約の導入文が編集データと一致しません。`);
    check(sameText(article.abstract, brief.introduction), `${file}: Article.abstract が読者向けの導入文と一致しません。`);
    check(article.about?.name === brief.subject?.name && article.about?.['@type'] === brief.subject?.type,
      `${file}: Article.about が記事の対象と一致しません。`);
    check(article.datePublished === brief.publishedDate && article.dateModified === brief.modifiedDate,
      `${file}: 公開・更新日が記事別の編集データと一致しません。`);
    const citations = Array.isArray(article.citation) ? article.citation : [];
    check(citations.length >= 1 && citations.every(externalUrl), `${file}: Article.citation に有効な外部資料URLが必要です。`);
    const anchors = [...markedBrief.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
      .map(([, attrs, body]) => ({ ...attributes(attrs), label: plainText(body) }));
    for (const key of ['strengths', 'record', 'reputation']) {
      const answer = brief[key] || {};
      check(typeof answer.text === 'string' && containsText(markedBrief, answer.text), `${file}: ${key} の回答が編集データと一致しません。`);
      check(externalUrl(answer.sourceUrl), `${file}: ${key} の出典は有効な外部URLにしてください。`);
      check(!!answer.sourceLabel && anchors.some(anchor => anchor.href === answer.sourceUrl && sameText(anchor.label, answer.sourceLabel)),
        `${file}: ${key} の回答に対応する出典リンクがありません。`);
      check(citations.includes(answer.sourceUrl), `${file}: ${key} の資料が Article.citation にありません。`);
    }
    if (mediaRecord) {
      const spotlights = [...markedBrief.matchAll(/<section\b[^>]*class=["'][^"']*\bmedia-spotlight\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi)];
      check(spotlights.length === 1, `${file}: 冒頭の掲載媒体欄は1つ必要です。`);
      const spotlight = spotlights[0]?.[1] || '';
      const media = Object.entries(mediaRecord.media || {});
      check(media.length > 0 && media.every(([, url]) => externalUrl(url)), `${file}: 掲載媒体に有効な外部URLが必要です。`);
      check(new Set(media.map(([, url]) => url)).size === media.length, `${file}: 同じURLを複数媒体として数えています。`);
      check(['取材記事', 'ニュース記事'].includes(mediaRecord.type), `${file}: 掲載記事の種類を根拠に沿って設定してください。`);
      check(containsText(spotlight, mediaRecord.title), `${file}: 掲載媒体欄の元記事見出しが一致しません。`);
      check(containsText(spotlight, `外部メディアの${mediaRecord.type}で紹介`), `${file}: 取材・ニュース記事の表記が編集データと一致しません。`);
      check(containsText(spotlight, `${media.length}媒体掲載`), `${file}: 媒体数が確認済みURLの数と一致しません。`);
      check(isoDate(mediaRecord.date) && [...spotlight.matchAll(/<time\b[^>]*>/gi)].some(match => attributes(match[0]).datetime === mediaRecord.date),
        `${file}: 元ニュースの掲載日が一致しません。`);
      const mediaAnchors = [...spotlight.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
        .map(([, attrs, body]) => ({ ...attributes(attrs), label: plainText(body).replace(/↗/g, '').trim() }));
      check(mediaAnchors.length === media.length, `${file}: 掲載媒体欄のリンク数が元データと一致しません。`);
      for (const [name, url] of media) {
        check(mediaAnchors.some(anchor => anchor.href === url && sameText(anchor.label, name)), `${file}: ${name} の掲載リンクが一致しません。`);
        check(citations.includes(url), `${file}: ${name} の掲載URLが Article.citation にありません。`);
      }
    }
  }
  const description = metaValue(html, 'name', 'description');
  check(!!description && sameText(description, article.description), `${file}: description と Article.description が一致しません。`);
  check(sameText(description, metaValue(html, 'property', 'og:description')), `${file}: description と OG description が一致しません。`);
  check(containsText(contentOf(html, /<body\b[^>]*>([\s\S]*?)<\/body>/i), description), `${file}: description が本文の説明と一致しません。`);
  check(article['@id'] === `${canonicalUrl}#article`, `${file}: Article の識別URLが一致しません。`);
  check(article.author?.['@id'] === 'https://minnano-hyouban.com/editor.html#person' && article.author?.name === '漆沢祐樹', `${file}: Article.author が編集責任者と一致しません。`);
  check(article.publisher?.name === '漆沢祐樹' && article.publisher?.['@type'] === 'Person', `${file}: Article.publisher が個人運営者と一致しません。`);
  check(/<a\b[^>]*href=["'](?:https:\/\/minnano-hyouban\.com)?\/editor\.html(?:#person)?["'][^>]*>\s*漆沢\s*祐樹\s*<\/a>/i.test(html), `${file}: 本文の著者リンクがありません。`);
  for (const key of ['datePublished', 'dateModified']) {
    check(isoDate(article[key]), `${file}: Article.${key} が有効な日付ではありません。`);
    const dates = [...html.matchAll(/<time\b[^>]*>/gi)].map(match => attributes(match[0]).datetime);
    check(dates.some(date => date === article[key] || date === article[key]?.slice(0, 10)), `${file}: ${key} の日付が本文に表示されていません。`);
  }
  check(Date.parse(article.dateModified) >= Date.parse(article.datePublished), `${file}: 更新日が公開日より前です。`);
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      check(!containsEvaluationSchema(data), `${file}: 未検証の評価点・レビュー用スキーマを追加しないでください。`);
    } catch { problems.push(`${file}: 構造化データを解析できません。`); }
  }
  const searchGraph = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .find(match => /\bdata-search-graph\b/.test(match[1]));
  let nodes = [];
  try { nodes = graphNodes(JSON.parse(searchGraph?.[2] || '{}')); } catch { /* Report the missing graph below. */ }
  check(nodes.some(node => hasType(node, 'WebPage') && (node.url === canonicalUrl || node['@id'] === `${canonicalUrl}#webpage`)), `${file}: 記事を示す WebPage データがありません。`);
  check(nodes.some(node => hasType(node, 'BreadcrumbList')), `${file}: パンくずの構造化データがありません。`);
  check(html.includes('official-visit'), `${file}: 公式サイトへの案内セクションを確認してください。`);
  check(archive.includes(`/reports/${id}/`), `${file}: 記事一覧の導線がありません。`);
}

check(home.includes('href="/articles.html"'), 'トップから記事一覧への導線がありません。');
check((home.match(/href="\/reports\/[a-z0-9-]+\/"/g) || []).length >= 8, 'トップの注目記事が不足しています。');

if (problems.length) {
  for (const problem of problems) console.error(`- ${problem}`);
  console.error(`検証失敗: ${problems.length} 件`);
  process.exitCode = 1;
} else {
  console.log(`調査記事 ${reportIds.length} 件のタイトル・URL・一覧導線・表示要約・まとめ・FAQ・出典・構造化データを確認しました。`);
}
