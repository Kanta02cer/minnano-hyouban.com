#!/usr/bin/env node
'use strict';

// dist/ contains only this allowlist. Pages currently publishes main/;
// stage-branch-root.js copies this snapshot there while legacy files remain.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'site-v2');
const outputDir = path.join(root, 'dist');
const siteUrl = 'https://minnano-hyouban.com';
const domain = 'minnano-hyouban.com';
const reportIds = ['11906', '11999', '12000', '11904', '11968', '11902', '11905', '11903', '11813', '11901', '11838', '11820', '11812', '11811', '11837', '11805', '11819', '11758', '11810', '11756', '11809', '11804', '11757', '11672', '11755', '11670', '11745', '11668', '11671', '11640', '11612', '11669', '11638', '11667', '11625', '11639', '11604', '11637', '11627', '11603', '11557', '11286', '11285', '11270', '11245', '11244', '11198', '11197', '11155', '11098', '11037', '11010', '10969', '10911', '10728', '10617', '10613', '10552', '10512', '10509', '10482'];

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

const generatedFiles = {
  'CNAME': `${domain}\n`,
  'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPages.map(page => `  <url><loc>${siteUrl}${page}</loc></url>`).join('\n')}\n</urlset>\n`,
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
  if (/メディくる|(?:^|["'/(])articles\/\d{16}(?:\/|["'?#])|article\.html\?id=|_post\//i.test(publicText)) {
    throw new Error('公開元に旧サイトの記事・運営名への参照が残っています。');
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
