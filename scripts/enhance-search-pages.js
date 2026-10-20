#!/usr/bin/env node
'use strict';

// Visible, reviewed summaries and matching metadata. No crawler-only content.
const fs = require('node:fs');
const path = require('node:path');
const {validateGuide, renderGuide} = require('./lib/report-reader-guide');
const {validateInterview, validateInterviewReference, sourceHref, interviewCitation, renderInterview} = require('./lib/report-interviews');
const root = path.resolve(__dirname, '..');
const base = 'https://minnano-hyouban.com';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const plain = value => decode(value.replace(/<[^>]*>/g, '')).trim();
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const jaDate = value => value.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, '$1年$2月$3日');
const briefs = {...JSON.parse(read('content/search-briefs-bulk.json')), ...JSON.parse(read('content/search-briefs-original.json'))};
const guides = JSON.parse(read('content/report-reader-guides.json'));
const interviews = JSON.parse(read('content/report-interviews.json'));
const entities = JSON.parse(read('content/report-entities.json')).articles;
const publicationHolds = JSON.parse(read('content/report-publication-holds.json')).articles;
const bulk = JSON.parse(read('content/bulk-report-sources.json'));
const coverage = Object.fromEntries(bulk.map(item => [item.id, {title:item.newsTitle, date:item.newsDate, media:item.media, type:item.coverageType}]));
Object.assign(coverage, JSON.parse(read('content/original-report-coverage.json')));
const editor = {'@type':'Person', '@id':`${base}/editor.html#person`, name:'漆沢祐樹', url:`${base}/editor.html`};
const website = {'@type':'WebSite', '@id':`${base}/#website`, url:`${base}/`, name:'みんなの評判.com', inLanguage:'ja', publisher:{'@id':editor['@id']}};
const reportIds = [...read('scripts/build-public-v2.js').match(/const reportIds\s*=\s*\[([^\]]*)\]/)[1].matchAll(/'([a-z0-9-]+)'/g)].map(match => match[1]);
const requested = process.argv.slice(2);
const selected = [];
for (let i = 0; i < requested.length; i += 2) {
  if (requested[i] !== '--id' || !reportIds.includes(requested[i + 1])) throw new Error('Use --id <published report ID>, once per target.');
  selected.push(requested[i + 1]);
}
if (!selected.length && fs.existsSync(path.join(root, 'content/report-presentation.json'))) {
  throw new Error('新レイアウトの全記事再生成は停止しました。レビューした対象だけ --id ID で指定し、docs/BRAND_STORY_WORKFLOW.mdに従ってください。');
}
if (selected.some(id => publicationHolds[id])) throw new Error('指定記事は公開現物の保全対象です。本文生成を停止しました。content/report-publication-holds.jsonを確認してください。');
const targetIds = selected.length ? selected : reportIds;
const pending = new Map();

function replaceOnce(text, pattern, replacement, label) {
  let count = 0;
  const out = text.replace(pattern, (...args) => { count++; return typeof replacement === 'function' ? replacement(...args) : replacement; });
  if (count !== 1) throw new Error(`Expected exactly one ${label}, found ${count}`);
  return out;
}

function graphTag(nodes) {
  return `<script type="application/ld+json" data-search-graph>${json({'@context':'https://schema.org','@graph':nodes})}</script>`;
}

for (const id of targetIds) {
  const b = briefs[id], c = coverage[id];
  if (!b || !c) throw new Error(`Missing reviewed brief or media coverage: ${id}`);
  const interview = interviews[id];
  if (interview) validateInterview(interview, id);
  validateGuide(guides[id], id, interview);
  for (const key of ['publishedDate','modifiedDate']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b[key] || '')) throw new Error(`Missing ${key}: ${id}`);
  }
  const file = `site-v2/reports/${id}/index.html`, url = `${base}/reports/${id}/`;
  const originalHtml = read(file);
  let html = originalHtml.replace(/<!-- SEARCH_BRIEF_START -->[\s\S]*?<!-- SEARCH_BRIEF_END -->/g, '');
  html = html.replace(/<!-- READER_GUIDE_START -->[\s\S]*?<!-- READER_GUIDE_END -->/g, '');
  html = html.replace(/<!-- INTERVIEW_NOTES_START -->[\s\S]*?<!-- INTERVIEW_NOTES_END -->/g, '');
  if (originalHtml.includes('data-brand-story="20261020"')) {
    html = html.replace(/<section\b[^>]*\bid="company-profile"[^>]*>[\s\S]*?<\/section>/, '');
    html = html.replace(/<p\b[^>]*class="report-byline"[^>]*>[\s\S]*?<\/p>/, '');
  }
  html = html.replace(/<span id="report-detail"><\/span>/g, '');
  html = html.replace(/<script type="application\/ld\+json" data-search-graph>[\s\S]*?<\/script>\n/g, '');
  const articleMatch = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!articleMatch) throw new Error(`Missing source Article metadata: ${id}`);
  const oldArticle = JSON.parse(articleMatch[1]);
  const heading = oldArticle.headline;
  const subject = {'@type':b.subject.type, '@id':`${url}#subject`, name:b.subject.name};
  const answers = [
    ['strengths','特徴・強みは？'],
    ['record','確認できる実績は？'],
    ['reputation','口コミ・評判は？'],
  ].map(([key,label]) => {
    const answer = b[key];
    const source = answer?.source || {url:answer?.sourceUrl,label:answer?.sourceLabel};
    if (!answer?.text || !source.label) throw new Error(`Invalid ${id} ${key}`);
    if (source.kind === 'interview') validateInterviewReference(source, interview, id);
    else if (!/^https?:\/\//.test(source.url)) throw new Error(`Invalid ${id} ${key} source`);
    return `<div class="brief-answer" id="brief-${key}"><h3>${label}</h3><p>${esc(answer.text)}</p><p class="brief-source">出典：<a href="${esc(sourceHref(source))}">${esc(source.label)}</a> <span aria-hidden="true">↗</span></p></div>`;
  }).join('\n');
  const mediaLinks = Object.entries(c.media).map(([name,url]) => `<li><a href="${esc(url)}">${esc(name)} <span aria-hidden="true">↗</span></a></li>`).join('');
  const count = Object.keys(c.media).length;
  const subjectLabel = b.subject.name + (b.subject.type === 'Person' ? '氏' : '');
  const briefHtml = `
<!-- SEARCH_BRIEF_START -->
<section class="media-spotlight" aria-labelledby="media-spotlight-heading">
  <div class="media-spotlight-label"><span>MEDIA COVERAGE</span><strong>${count}<small>媒体掲載</small></strong></div>
  <div><h2 id="media-spotlight-heading">外部メディアの${esc(c.type || 'ニュース記事')}で紹介</h2><p class="media-news-title">${esc(c.title)}</p><p class="media-date">ニュース掲載：<time datetime="${c.date}">${jaDate(c.date)}</time></p><ul class="media-links">${mediaLinks}</ul><p class="media-context">各リンクは同じ記事の掲載先です。会社や人物の取り組みを紹介しており、媒体ごとの独立した評価・推薦を表すものではありません。</p></div>
</section>
<section class="research-brief" id="research-brief" aria-labelledby="research-brief-heading">
  <p class="section-kicker">RESEARCH BRIEF</p><h2 id="research-brief-heading">${esc(subjectLabel)}の調査ポイント</h2>
  <p class="brief-introduction" id="subject">${esc(b.introduction)}</p>
  <div class="brief-answers">${answers}</div>
</section>
<p class="report-byline">執筆・編集：<a href="/editor.html">漆沢祐樹</a><span>公開：<time datetime="${b.publishedDate}">${jaDate(b.publishedDate)}</time></span><span>記事更新：<time datetime="${b.modifiedDate}">${jaDate(b.modifiedDate)}</time></span><small>資料の確認時点は本文・出典欄に記載しています。</small></p>
<nav class="report-toc" aria-label="記事の案内"><a href="#brief-strengths">特徴・強み</a><a href="#brief-record">実績</a><a href="#brief-reputation">口コミ・評判</a><a href="#report-detail">詳しい調査内容</a><a href="#report-summary">まとめ</a><a href="#report-faq">よくある質問</a></nav>
<span id="report-detail"></span>
<!-- SEARCH_BRIEF_END -->
`;
  const tocBrief = interview ? briefHtml.replace('<a href="#report-detail">詳しい調査内容</a>', '<a href="#interview-notes">インタビューの詳細</a><a href="#company-profile">会社情報</a><a href="#report-detail">詳しい調査内容</a>') : briefHtml;
  const introContent = interview ? tocBrief.replace('<span id="report-detail"></span>', '') + renderInterview(interview, id) + '<span id="report-detail"></span>' : tocBrief;
  html = replaceOnce(html, /(<(?:article|div)\b[^>]*class="report-main(?: [^"]*)?"[^>]*>)/, (_, opening) => opening + introContent, `${id} main`);
  html = replaceOnce(html, /(<section\b[^>]*class="[^"]*\bofficial-visit\b[^"]*"[^>]*>)/, (_, opening) => renderGuide(guides[id], subjectLabel) + opening, `${id} official visit`);
  html = replaceOnce(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(b.introduction)}">`, `${id} description`);
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(b.introduction)}">`, `${id} og description`);
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/)[1];
  const citations = [...new Set([...body.matchAll(/<a\b[^>]*href="(https?:\/\/[^\"]+)"/g)]
    .map(match => decode(match[1])).filter(source => new URL(source).origin !== base))];
  if (interview) citations.push(interviewCitation(interview, url));
  const about = entities[id] || subject;
  const article = {...oldArticle,'@id':`${url}#article`,url,description:b.introduction,abstract:b.introduction,datePublished:b.publishedDate,dateModified:b.modifiedDate,author:editor,publisher:editor,about,citation:citations,isPartOf:{'@id':website['@id']}};
  html = replaceOnce(html, /<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/, `<script type="application/ld+json">${json(article)}</script>`, `${id} Article`);
  const breadcrumb = {'@type':'BreadcrumbList','@id':`${url}#breadcrumb`,itemListElement:[
    {'@type':'ListItem',position:1,name:'トップ',item:`${base}/`},
    {'@type':'ListItem',position:2,name:'調査レポート',item:`${base}/articles.html`},
    {'@type':'ListItem',position:3,name:heading,item:url},
  ]};
  html = html.replace('</head>', `${graphTag([website,editor,{'@type':'WebPage','@id':`${url}#webpage`,url,name:heading,inLanguage:'ja',dateModified:b.modifiedDate,mainEntity:{'@id':article['@id']},isPartOf:{'@id':website['@id']},breadcrumb:{'@id':breadcrumb['@id']}},breadcrumb])}\n</head>`);
  // Preserve the verified destinations and number of registered links across
  // evidence regeneration. A changed URL/count requires reviewed registry work.
  const configMatch = originalHtml.match(/<script id="media-analytics-config" type="application\/json">([\s\S]*?)<\/script>/);
  if (configMatch) {
    const config = JSON.parse(configMatch[1]);
    const linkById = new Map(config.links.map(link => [link.id, link]));
    const anchors = text => [...text.matchAll(/<a\b[^>]*>/g)].map(match => ({
      href: decode(match[0].match(/\bhref="([^"]*)"/)?.[1] || ''),
      marker: match[0].match(/\bdata-mm-link="([^"]*)"/)?.[1],
    }));
    const oldAnchors = anchors(originalHtml), newAnchors = anchors(html);
    for (const href of new Set(config.links.map(link => link.href))) {
      if (oldAnchors.filter(a => a.href === href).length !== newAnchors.filter(a => a.href === href).length)
        throw new Error(`${id}: ${href} の導線数が変わりました。計測台帳と照合してください。`);
    }
    const preserved = new Set();
    for (const anchor of newAnchors.filter(a => a.marker)) {
      if (preserved.has(anchor.marker) || linkById.get(anchor.marker)?.href !== anchor.href)
        throw new Error(`${id}: 既存の計測マーカーが不一致です。`);
      preserved.add(anchor.marker);
    }
    const queues = new Map();
    for (const link of config.links) {
      if (preserved.has(link.id)) continue;
      if (!queues.has(link.href)) queues.set(link.href, []);
      queues.get(link.href).push(link.id);
    }
    html = html.replace(/<a\b[^>]*>/g, tag => {
      if (/\bdata-mm-link="/.test(tag)) return tag;
      const href = decode(tag.match(/\bhref="([^"]*)"/)?.[1] || '');
      if (!queues.has(href)) return tag;
      const queue = queues.get(href);
      if (!queue.length) return tag;
      return tag.replace(/\sdata-mm-link="[^"]*"/g, '').replace(/>$/, ` data-mm-link="${queue.shift()}">`);
    });
    if ([...queues.values()].some(queue => queue.length)) throw new Error(`${id}: 計測対象リンクが減少しました。原稿と台帳を再確認してください。`);
  }
  pending.set(file, html);
}

// The other public pages share the same site and editor identities.
for (const filename of (selected.length ? [] : ['index.html','articles.html','editor.html','guide.html','privacy.html','disclaimer.html'])) {
  const file = `site-v2/${filename}`, url = filename === 'index.html' ? `${base}/` : `${base}/${filename}`;
  let html = read(file).replace(/<script type="application\/ld\+json" data-search-graph>[\s\S]*?<\/script>\n/g, '');
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*/g, (tag, value) => {
    const node = JSON.parse(value);
    return ['WebSite', 'CollectionPage'].includes(node['@type']) ? '' : tag;
  });
  const title = plain(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
  const page = {'@type':filename === 'articles.html' ? 'CollectionPage' : 'WebPage','@id':`${url}#webpage`,url,name:title,inLanguage:'ja',isPartOf:{'@id':website['@id']},publisher:{'@id':editor['@id']}};
  // This is the date this metadata/content revision was prepared, not each build time.
  page.dateModified = ['index.html', 'articles.html'].includes(filename) ? '2026-10-16' : filename === 'guide.html' ? '2026-10-12' : '2026-09-28';
  if (filename === 'editor.html') page.about = {'@id':editor['@id']};
  const nodes = [website,editor,page];
  if (filename === 'articles.html') {
    const list = {'@type':'ItemList','@id':`${url}#reports`,numberOfItems:reportIds.length,itemListElement:reportIds.map((id,index)=>({'@type':'ListItem',position:index+1,url:`${base}/reports/${id}/`,name:JSON.parse(pending.get(`site-v2/reports/${id}/index.html`).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]).headline}))};
    page.mainEntity = {'@id':list['@id']}; nodes.push(list);
  }
  html = html.replace('</head>',`${graphTag(nodes)}\n</head>`);
  pending.set(file,html);
}
// Validate all source records before touching any file; reruns are byte-stable.
for (const [file,html] of pending) fs.writeFileSync(path.join(root,file),html.replace(/[\t ]+$/gm, ''));
if (selected.length) {
  const {execFileSync} = require('node:child_process');
  execFileSync('python3', [path.join(root, 'scripts/apply-brand-design.py'), ...selected.flatMap(id => ['--id', id])], {stdio:'inherit'});
}
console.log(`Updated visible summaries, media coverage and metadata for ${targetIds.length} reports.`);
