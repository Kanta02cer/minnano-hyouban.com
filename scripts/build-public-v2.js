#!/usr/bin/env node
'use strict';

// dist/ contains only this allowlist. Pages currently publishes main/;
// stage-branch-root.js copies this snapshot there and retires obsolete AI files.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'site-v2');
const outputDir = path.join(root, 'dist');
const siteUrl = 'https://minnano-hyouban.com';
const domain = 'minnano-hyouban.com';
const reportIds = ['12042', '11970', '11906', '11999', '12000', '11904', '11968', '11902', '11905', '11903', '11813', '11901', '11838', '11820', '11812', '11811', '11837', '11805', '11819', '11758', '11810', '11756', '11809', '11804', '11757', '11672', '11755', '11670', '11745', '11668', '11671', '11640', '11612', '11669', '11638', '11667', '11625', '11639', '11607', '11604', '11637', '11627', '11603', '11557', '11286', '11285', '11270', '11245', '11244', '11198', '11197', '11155', '11098', '11037', '11010', '10969', '10911', '10728', '10617', '10613', '10552', '10512', '10509', '10482'];

const publicFiles = [
  ['site-v2/index.html', 'index.html'],
  ['site-v2/404.html', '404.html'],
  ['site-v2/articles.html', 'articles.html'],
  ['site-v2/guide.html', 'guide.html'],
  ['site-v2/editor.html', 'editor.html'],
  ['site-v2/privacy.html', 'privacy.html'],
  ['site-v2/disclaimer.html', 'disclaimer.html'],
  ['site-v2/site.css', 'site.css'],
  ['site-v2/home-b.css', 'home-b.css'],
  ['site-v2/site.js', 'site.js'],
  ['site-v2/sw.js', 'sw.js'],
  ['site-v2/favicon.svg', 'favicon.svg'],
  ...reportIds.map(id => [`site-v2/reports/${id}/index.html`, `reports/${id}/index.html`]),
];

const publicPages = [
  '/',
  '/articles.html',
  '/guide.html',
  '/editor.html',
  '/privacy.html',
  '/disclaimer.html',
  ...reportIds.map(id => `/reports/${id}/`),
];

function decodeText(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()];
    const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
  }).replace(/\s+/g, ' ').trim();
}

function pageMetadata(page) {
  const relative = page === '/' ? 'index.html' : page.replace(/^\//, '').replace(/\/$/, '/index.html');
  const html = fs.readFileSync(path.join(sourceDir, relative), 'utf8');
  const title = decodeText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
  const descriptionTag = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(match => match[0]).find(tag => /\bname=["']description["']/i.test(tag)) || '';
  const description = decodeText(descriptionTag.match(/\bcontent=(["'])([\s\S]*?)\1/i)?.[2] || '');
  const nodes = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(match => {
      const data = JSON.parse(match[1]);
      return Array.isArray(data) ? data : data['@graph'] || [data];
    });
  const datedNode = nodes.find(node => {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    return types.some(type => ['Article', 'WebPage', 'CollectionPage', 'ProfilePage', 'AboutPage'].includes(type))
      && /^\d{4}-\d{2}-\d{2}(?:T[^\s]+)?$/.test(node.dateModified || '')
      && Number.isFinite(Date.parse(node.dateModified));
  });
  const articleNode = nodes.find(node => (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).includes('Article'));
  // A date without a recorded time is not converted to an invented RSS time.
  const published = articleNode?.datePublished || articleNode?.dateCreated;
  const pubDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(published || '')
    && Number.isFinite(Date.parse(published)) ? new Date(published).toUTCString() : null;
  return { page, title, description, lastmod: datedNode?.dateModified, pubDate };
}

const metadata = publicPages.map(pageMetadata);
const xml = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const markdown = text => text.replace(/[\\[\]<>]/g, char => `\\${char}`);
const articleIndex = metadata.filter(item => item.page.startsWith('/reports/'))
  .map(item => `- [${markdown(item.title)}](${siteUrl}${item.page}): ${item.description}`).join('\n');

// The four withdrawn articles used a separate, obsolete review format.
// Keep their URLs readable as withdrawal notices, without preserving old claims.
const archiveNotices = Object.fromEntries([
  'article.html',
  ...['1794482170414453', '2221437250750372', '2252563132716439', '3340006759735454']
    .map(id => `articles/${id}/index.html`),
].map(file => [file, `<!doctype html>\n<html lang="ja">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <meta name="robots" content="noindex, follow">\n  <title>旧記事の公開終了 | みんなの評判.com</title>\n  <meta name="description" content="この旧記事の公開は終了しました。現在の調査記事は記事一覧からご覧いただけます。">\n  <link rel="icon" href="/favicon.svg" type="image/svg+xml">\n  <link rel="stylesheet" href="/site.css">\n</head>\n<body>\n  <header class="site-header"><div class="wrap" style="padding-block:1.5rem"><a class="brand" href="/">みんなの評判.com</a></div></header>\n  <main class="wrap" style="padding-block:5rem;max-width:48rem">\n    <h1>旧記事の公開を終了しました</h1>\n    <p>現在は、ニュース記事と公式サイトなどの公開情報を調べ、企業・代表者・サービスを紹介しています。</p>\n    <p><a href="/articles.html">現在の調査記事一覧を見る</a></p>\n  </main>\n</body>\n</html>\n`]));

const generatedFiles = {
  ...archiveNotices,
  'CNAME': `${domain}\n`,
  'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${metadata.map(item => `  <url><loc>${siteUrl}${item.page}</loc>${item.lastmod ? `<lastmod>${xml(item.lastmod)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`,
  'llms.txt': `# みんなの評判.com\n\n> ネットニュースで紹介された企業・代表者・サービスについて、ニュース記事と公式サイトなどの公開情報を調べる個人運営メディアです。\n\n## サイトについて\n\n- 運営者・編集責任者: 漆沢祐樹\n- [編集責任者](${siteUrl}/editor.html)\n- [調査方法と記事の読み方](${siteUrl}/guide.html)\n- [記事一覧](${siteUrl}/articles.html)\n- [サイトマップ](${siteUrl}/sitemap.xml)\n\nこのファイルは公開記事の案内です。各記事の本文に、情報源、確認日、ニュースで報じられた内容、企業が公表した内容、口コミの確認範囲を記載しています。複数媒体への同一記事の掲載と、独立した取材・利用者による評価は区別しています。\n\n## 公開記事\n\n${articleIndex}\n`,
  'feed.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n<channel>\n  <title>みんなの評判.com</title>\n  <link>${siteUrl}/</link>\n  <description>ニュースと公開情報から企業・代表者・サービスの口コミ・評判・実績を調べる個人運営メディア</description>\n  <language>ja</language>\n  <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>\n${metadata.filter(item => item.page.startsWith('/reports/')).map(item => `  <item>\n    <title>${xml(item.title)}</title>\n    <link>${siteUrl}${item.page}</link>\n    <guid isPermaLink="true">${siteUrl}${item.page}</guid>\n    <description>${xml(item.description)}</description>\n    <dc:creator>漆沢祐樹</dc:creator>${item.pubDate ? `\n    <pubDate>${item.pubDate}</pubDate>` : ''}\n  </item>`).join('\n')}\n</channel>\n</rss>\n`,
};

function assertRegularFile(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) {
    throw new Error(`公開元ファイルが通常の空でないファイルではありません: ${file}`);
  }
}

function build() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`公開元ディレクトリがありません: ${sourceDir}`);
  }

  // Validate every input before replacing a previous local build.
  for (const [src] of publicFiles) assertRegularFile(path.join(root, src));

  const publicText = publicFiles
    .filter(([, dest]) => /\.(?:html|css|js)$/.test(dest))
    .map(([src]) => fs.readFileSync(path.join(root, src), 'utf8'))
    .join('\n');
  if (/(?:^|["'/(])articles\/\d{16}(?:\/|["'?#])|article\.html\?id=|_post\//i.test(publicText)) {
    throw new Error('公開元に旧サイトの記事への参照が残っています。');
  }

  // The user's 2026-10-04 requests permit the service profile and factual
  // relationship disclosures. The site's operator and retired contact stay unchanged.
  const relationshipPages = new Set(['reports/11098/index.html', 'reports/11155/index.html']);
  const medikuruPages = new Set(['index.html', 'articles.html', 'reports/11607/index.html', ...relationshipPages]);
  for (const [src, dest] of publicFiles.filter(([, file]) => /\.(?:html|css|js)$/.test(file))) {
    const text = fs.readFileSync(path.join(root, src), 'utf8');
    if (/メディくる|medikuru/i.test(text) && !medikuruPages.has(dest)) {
      throw new Error(`${src}: メディくるの紹介は指定記事とその一覧導線だけに追加できます。`);
    }
    const outsideMain = text.replace(/<main\b[^>]*>[\s\S]*?<\/main>/gi, '');
    const sharedChrome = [...outsideMain.matchAll(/<(header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi)]
      .map(match => match[0]).join('\n');
    if (/メディくる|medikuru/i.test(sharedChrome) || /[a-z0-9._%+-]+@medikuru\.com/i.test(text)) {
      throw new Error(`${src}: 旧運営名・共通問い合わせ先を復活させないでください。`);
    }
    let officialLinkScope = text;
    if (relationshipPages.has(dest)) {
      const disclosures = [...text.matchAll(/<section\b(?=[^>]*\bid=["']editorial-relationship["'])[^>]*>[\s\S]*?<\/section>/gi)];
      if (disclosures.length !== 1) {
        throw new Error(`${src}: 編集者との事業上の関係は editorial-relationship 節に明記してください。`);
      }
      for (const [, url] of disclosures[0][0].matchAll(/\bhref=["']([^"']+)["']/gi)) {
        if (/(?:[a-z0-9-]+\.)?medikuru\.com/i.test(url) && url !== 'https://medikuru.com/') {
          throw new Error(`${src}: 関係開示の出典にはメディくる公式会社情報のURLだけを使用してください。`);
        }
      }
      // Citation JSON-LD is generated from visible source links by the enhancer.
      officialLinkScope = text.replace(disclosures[0][0], '')
        .replace(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, '');
    }
    if (dest !== 'reports/11607/index.html' && /(?:[a-z0-9-]+\.)?medikuru\.com/i.test(officialLinkScope)) {
      throw new Error(`${src}: メディくるの公式導線は指定サービス記事、または指定記事の関係開示の出典だけに置いてください。`);
    }
  }

  const allowedPaths = new Set([
    '/',
    ...publicFiles.map(([, dest]) => `/${dest}`),
    ...Object.keys(generatedFiles).map(dest => `/${dest}`),
    ...reportIds.flatMap(id => [`/reports/${id}/`, `/reports/${id}`]),
  ]);
  for (const [src, dest] of publicFiles.filter(([, file]) => file.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, src), 'utf8');
    for (const [, link] of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      if (link.startsWith('#') || /^(?:mailto:|tel:)/i.test(link)) continue;
      const target = new URL(link, `${siteUrl}/${dest}`);
      if (target.origin === siteUrl && !allowedPaths.has(target.pathname)) {
        throw new Error(`${src} が公開対象外のファイルを参照しています: ${link}`);
      }
    }
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [src, dest] of publicFiles) {
    fs.mkdirSync(path.dirname(path.join(outputDir, dest)), { recursive: true });
    fs.copyFileSync(path.join(root, src), path.join(outputDir, dest));
  }
  for (const [dest, content] of Object.entries(generatedFiles)) {
    fs.mkdirSync(path.dirname(path.join(outputDir, dest)), { recursive: true });
    fs.writeFileSync(path.join(outputDir, dest), content, 'utf8');
  }

  const expected = [...publicFiles.map(([, dest]) => dest), ...Object.keys(generatedFiles)].sort();
  const listOutputFiles = (dir, prefix = '') => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => entry.isDirectory()
      ? listOutputFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`]);
  const actual = listOutputFiles(outputDir).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`公開ファイル一覧が allowlist と一致しません: ${actual.join(', ')}`);
  }
  console.log(`公開サイトを生成: dist/ (${actual.join(', ')})`);
}

try {
  build();
} catch (error) {
  console.error(`ビルド失敗: ${error.message}`);
  process.exitCode = 1;
}
