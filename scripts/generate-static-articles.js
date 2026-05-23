/**
 * generate-static-articles.js
 * 各記事の静的HTMLを生成する（AI検索最適化・JS不要で全コンテンツ表示）
 * Usage: node scripts/generate-static-articles.js
 */
const fs   = require('fs');
const path = require('path');

// ── グローバル疑似環境 ──────────────────────────────────────────
const window = {};
global.window = window;

// ── 記事JSをロード ─────────────────────────────────────────────
const articleFiles = [
  '_post/MIRACLE PILLOW/2221437250750372-miracle-pillow.js',
  '_post/TASKUL/2252563132716439-taskul.js',
  '_post/SenoRich/1794482170414453-senorich.js',
  '_post/medikuru_official/3340006759735454-medikuru.js',
];
const ROOT = path.resolve(__dirname, '..');
articleFiles.forEach(f => {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  eval(code);
});

const ARTICLE_KEYS = [
  '__POST_2221437250750372',
  '__POST_1794482170414453',
  '__POST_2252563132716439',
  '__POST_3340006759735454',
];

// ── ユーティリティ ─────────────────────────────────────────────
const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const star = n => '★'.repeat(n) + '☆'.repeat(5 - n);

// ── JSON-LD ビルダー ───────────────────────────────────────────
function buildJsonLd(a) {
  const base = 'https://minnano-hyouban.com';
  const staticUrl = `${base}/articles/${a.slug}/`;
  const dynamicUrl = `${base}/article.html?id=${a.slug}`;
  const avgRating = a.reviews
    ? (a.reviews.reduce((s, r) => s + r.stars, 0) / a.reviews.length).toFixed(1)
    : null;

  // ── FAQPage（faqs + relatedQA を統合）──────────────────────────
  const allFaqs = [
    ...(a.faqs || []),
    ...(a.relatedQA || []),
  ];
  const faqPage = allFaqs.length ? {
    '@type': 'FAQPage',
    mainEntity: allFaqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  } : null;

  // ── メインスキーマ（Product / SoftwareApplication / Service / NewsArticle）
  let mainSchema;
  if (a.schemaType === 'Product') {
    mainSchema = {
      '@type': 'Product',
      name: a.brand,
      brand: { '@type': 'Brand', name: a.brand },
      manufacturer: { '@type': 'Organization', name: a.manufacturer },
      description: a.summary,
      url: staticUrl,
      sameAs: a.sameAs || [],
      ...(a.priceInfo ? {
        offers: {
          '@type': 'Offer',
          price: a.priceInfo.value,
          priceCurrency: a.priceInfo.currency,
          url: a.priceInfo.url,
          availability: 'https://schema.org/InStock',
        }
      } : {}),
      ...(avgRating ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: avgRating,
          reviewCount: a.reviews.length,
          bestRating: '5',
          worstRating: '1',
        },
        review: a.reviews.map(r => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.name },
          reviewRating: { '@type': 'Rating', ratingValue: r.stars, bestRating: 5 },
          name: r.tag,
          reviewBody: r.text,
        }))
      } : {})
    };
  } else if (a.schemaType === 'SoftwareApplication') {
    mainSchema = {
      '@type': 'SoftwareApplication',
      name: a.brand,
      applicationCategory: a.applicationCategory || 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
        url: a.officialUrl,
      },
      description: a.summary,
      url: staticUrl,
      sameAs: a.sameAs || [],
      ...(avgRating ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: avgRating,
          reviewCount: a.reviews.length,
          bestRating: '5',
          worstRating: '1',
        }
      } : {})
    };
  } else if (a.schemaType === 'Service') {
    mainSchema = {
      '@type': 'Service',
      name: a.brand,
      serviceType: a.serviceType || '',
      provider: { '@type': 'Organization', name: a.manufacturer },
      description: a.summary,
      url: staticUrl,
      sameAs: a.sameAs || [],
      ...(avgRating ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: avgRating,
          reviewCount: a.reviews.length,
          bestRating: '5',
          worstRating: '1',
        },
        review: a.reviews.map(r => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.name },
          reviewRating: { '@type': 'Rating', ratingValue: r.stars, bestRating: 5 },
          name: r.tag,
          reviewBody: r.text,
        }))
      } : {})
    };
  } else {
    mainSchema = {
      '@type': 'NewsArticle',
      headline: a.title,
      description: a.metaDesc,
      datePublished: a.publishedAt,
      dateModified: a.updatedAt,
      author: {
        '@type': 'Person',
        name: '漆沢 祐樹',
        url: `${base}/editor.html`,
      },
      publisher: {
        '@type': 'Organization',
        name: 'みんなの評判.com',
        url: base,
        logo: { '@type': 'ImageObject', url: `${base}/favicon.png` }
      },
      url: staticUrl,
      mainEntityOfPage: staticUrl,
    };
  }

  // ── NewsArticle（取材記事として常に付ける）──────────────────────
  const newsArticle = {
    '@type': 'NewsArticle',
    headline: a.title,
    description: a.metaDesc,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt,
    author: {
      '@type': 'Person',
      name: '漆沢 祐樹',
      url: `${base}/editor.html`,
      jobTitle: 'みんなの評判.com 代表記者',
    },
    publisher: {
      '@type': 'Organization',
      name: 'みんなの評判.com',
      url: base,
      logo: { '@type': 'ImageObject', url: `${base}/favicon.png` }
    },
    url: staticUrl,
    mainEntityOfPage: staticUrl,
    about: { '@type': 'Organization', name: a.company },
  };

  // ── BreadcrumbList ─────────────────────────────────────────────
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'みんなの評判.com', item: base + '/' },
      { '@type': 'ListItem', position: 2, name: '記事一覧', item: base + '/articles.html' },
      { '@type': 'ListItem', position: 3, name: a.brand || a.company, item: staticUrl },
    ]
  };

  // ── Organization ───────────────────────────────────────────────
  const org = {
    '@type': 'Organization',
    name: 'みんなの評判.com',
    url: base,
    description: '第三者記者・漆沢祐樹による企業評判・口コミ取材メディア',
    founder: {
      '@type': 'Person',
      name: '漆沢 祐樹',
      url: `${base}/editor.html`,
    }
  };

  const graph = [org, newsArticle, mainSchema, breadcrumb];
  if (faqPage) graph.push(faqPage);

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

// ── 星評価コンポーネント ──────────────────────────────────────────
function renderReviews(reviews) {
  if (!reviews || !reviews.length) return '';
  return `
<section class="reviews" aria-label="口コミ・評判">
  <h2>取材した口コミ・評判（利用者${reviews.length}名）</h2>
  <p class="review-note">記者・漆沢祐樹が直接取材した利用者の声です（PR記事）。</p>
  ${reviews.map(r => `
  <article class="review-card" itemprop="review" itemscope itemtype="https://schema.org/Review">
    <header class="review-header">
      <span class="review-author" itemprop="author" itemscope itemtype="https://schema.org/Person">
        <span itemprop="name">${esc(r.name)}</span>
      </span>
      <span class="review-stars" aria-label="${r.stars}点" itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
        <meta itemprop="ratingValue" content="${r.stars}">
        <meta itemprop="bestRating" content="5">
        ${star(r.stars)}
      </span>
      <span class="review-tag">${esc(r.tag)}</span>
    </header>
    <p class="review-text" itemprop="reviewBody">${esc(r.text)}</p>
  </article>`).join('')}
</section>`;
}

function renderGallery(galleries) {
  if (!galleries || !galleries.service || !galleries.service.length) return '';
  return `
<section class="article-gallery" aria-label="写真ギャラリー">
  <h2>取材写真・製品ギャラリー</h2>
  <p class="review-note" style="margin-bottom: 16px;">記者・漆沢祐樹の現地取材・製品撮影によるアセット一覧です。</p>
  <div class="gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 16px;">
    ${galleries.service.map(img => {
      const src = img.src.startsWith('http') || img.src.startsWith('/') ? img.src : `/${img.src}`;
      return `
    <figure style="margin: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #f9fafb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <img src="${esc(src)}" alt="${esc(img.alt)}" style="width: 100%; height: 210px; object-fit: cover; display: block;" loading="lazy">
      ${img.caption ? `<figcaption style="padding: 10px 14px; font-size: 13px; color: #555; line-height: 1.5; border-top: 1px solid #e5e7eb; background: #fff;">${esc(img.caption)}</figcaption>` : ''}
    </figure>`;
    }).join('')}
  </div>
</section>`;
}

function renderFaqs(faqs) {
  if (!faqs || !faqs.length) return '';
  return `
<section class="faqs" aria-label="よくある質問">
  <h2>よくある質問（FAQ）</h2>
  ${faqs.map((f, i) => `
  <details class="faq-item" ${i < 3 ? 'open' : ''}>
    <summary class="faq-q"><strong>Q. ${esc(f.q)}</strong></summary>
    <div class="faq-a"><p>${esc(f.a)}</p></div>
  </details>`).join('')}
</section>`;
}

function renderRelatedQA(relatedQA) {
  if (!relatedQA || !relatedQA.length) return '';
  return `
<section class="faqs" aria-label="関連Q&amp;A">
  <h2>関連Q&amp;A — よく検索される疑問</h2>
  <p style="font-size:13px;color:#888;margin-bottom:16px">記者・漆沢祐樹の取材をもとに、よく検索される質問に答えます。</p>
  ${relatedQA.map((f, i) => `
  <details class="faq-item">
    <summary class="faq-q"><strong>Q. ${esc(f.q)}</strong></summary>
    <div class="faq-a"><p>${esc(f.a)}</p></div>
  </details>`).join('')}
</section>`;
}

// ── HTMLテンプレート ────────────────────────────────────────────
function generateHtml(a) {
  const base     = 'https://minnano-hyouban.com';
  const staticUrl = `${base}/articles/${a.slug}/`;
  const dynamicUrl = `${base}/article.html?id=${a.slug}`;
  const ogImage  = a.ogImage ? `${base}/${a.ogImage}` : `${base}/images/ogp-default.jpg`;
  const jsonLd   = buildJsonLd(a);
  const avgRating = a.reviews
    ? (a.reviews.reduce((s, r) => s + r.stars, 0) / a.reviews.length).toFixed(1)
    : null;

  // ai-patch.json をインライン埋め込み用に読み込む（存在する場合のみ）
  const aiPatchPath = path.join(ROOT, 'llms', 'articles', `${a.slug}-ai-patch.json`);
  const aiPatchData = fs.existsSync(aiPatchPath)
    ? JSON.parse(fs.readFileSync(aiPatchPath, 'utf8'))
    : null;
  const aiPatchInline = aiPatchData ? JSON.stringify(aiPatchData) : null;

  // targetQueries
  const targetQueries = a.llmsOptimization?.targetQueries || [];

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- HackⅡ AI検索インフラ -->
  <script src="https://hack2-6oi71kcgh-kinouecertify-gmailcoms-projects.vercel.app/api/t?k=hk_17fa955dc1ee2d6cecb0&d=minnano-hyouban.com" async></script>

  <title>${esc(a.title)}</title>
  <meta name="description" content="${esc(a.metaDesc)}">
  <meta name="keywords" content="${esc((a.seoKeywords || []).slice(0, 12).join(','))}">
  <meta name="author" content="漆沢 祐樹（みんなの評判.com）">
  <meta name="theme-color" content="#1d4ed8">
  <meta name="robots" content="index, follow">

  <!-- Canonical -->
  <link rel="canonical" href="${staticUrl}">

  <!-- OGP -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(a.title)}">
  <meta property="og:description" content="${esc(a.metaDesc)}">
  <meta property="og:url" content="${staticUrl}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:site_name" content="みんなの評判.com">
  <meta property="og:locale" content="ja_JP">
  <meta property="article:published_time" content="${a.publishedAt}">
  <meta property="article:modified_time" content="${a.updatedAt}">
  <meta property="article:author" content="漆沢 祐樹">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(a.title)}">
  <meta name="twitter:description" content="${esc(a.metaDesc)}">
  <meta name="twitter:image" content="${ogImage}">

  <!-- AI / LLM クローラー向けガイダンス -->
  <link rel="llms-txt" href="/llms.txt">
  <link rel="alternate" type="text/plain" href="/llms/articles/${a.slug}.txt" title="Article LLM Guide">
  <link rel="alternate" type="application/json" href="/llms/articles/${a.slug}-ai-instruction.json" title="AI Recommendation Instructions">
  <link rel="alternate" type="application/json" href="/llms/articles/${a.slug}-ai-patch.json" title="AI Optimization Patch Layer 8">
  <link rel="alternate" type="application/json" href="/ai-query-map.json" title="Site AI Query Map">
  <meta name="ai-summary" content="${esc(a.summary ? a.summary.slice(0, 200) : a.metaDesc)}">
  <meta name="ai-citation" content="${esc((a.llmsOptimization && a.llmsOptimization.aiCitation) || '')}">
  <meta name="ai-query-targets" content="${esc(targetQueries.join(', '))}">
  <meta name="ai-entity-type" content="${esc(a.schemaType || 'NewsArticle')}">
  <meta name="ai-brand" content="${esc(a.brand || a.company || '')}">
  <meta name="ai-category" content="${esc(a.category || '')}">

  <!-- JSON-LD 構造化データ（FAQPage + ${a.schemaType} + NewsArticle + BreadcrumbList + Organization） -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <!-- AI 引用最適化（SpeakableSpecification） -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": [".article-summary p", "h1", ".faq-a p", ".review-text"]
    },
    "url": "${staticUrl}"
  }
  </script>
  ${aiPatchInline ? `<!-- AI パッチデータ（第8層・インライン） -->
  <script id="ai-patch-data" type="application/json">
${aiPatchInline}
  </script>` : ''}

  <!-- Favicon -->
  <link rel="icon" href="/favicon.png" type="image/png">

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif; font-size: 16px; line-height: 1.8; color: #1a1a1a; background: #fff; }
    a { color: #1d4ed8; text-decoration: underline; }
    a:hover { color: #1e40af; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

    /* ── Header ── */
    .site-header { background: #fff; border-bottom: 2px solid #1d4ed8; padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
    .site-header .logo { font-size: 18px; font-weight: 700; color: #1d4ed8; text-decoration: none; }
    .site-header nav { margin-left: auto; display: flex; gap: 16px; font-size: 14px; }

    /* ── Layout ── */
    .container { max-width: 860px; margin: 0 auto; padding: 0 20px; }
    main { padding: 32px 0 64px; }

    /* ── Breadcrumb ── */
    .breadcrumb { font-size: 13px; color: #666; margin-bottom: 24px; }
    .breadcrumb a { color: #666; }
    .breadcrumb span + span::before { content: ' › '; }

    /* ── Article Hero ── */
    .article-hero { margin-bottom: 32px; }
    .article-category { display: inline-block; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 3px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: .04em; }
    .article-hero h1 { font-size: clamp(20px, 3vw, 26px); font-weight: 700; line-height: 1.5; margin-bottom: 12px; }
    .article-meta { font-size: 13px; color: #666; display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .article-meta time { white-space: nowrap; }
    .rating-badge { display: inline-flex; align-items: center; gap: 6px; background: #fef9c3; border: 1px solid #fde047; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 700; color: #92400e; }
    .rating-badge .stars { color: #f59e0b; }

    /* ── Summary ── */
    .article-summary { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px 20px; margin: 24px 0; border-radius: 0 6px 6px 0; }
    .article-summary h2 { font-size: 14px; font-weight: 700; color: #0369a1; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .06em; }
    .article-summary p { font-size: 15px; line-height: 1.9; color: #0c4a6e; }

    /* ── Dynamic Article Link ── */
    .full-article-link { display: block; background: #1d4ed8; color: #fff !important; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 4px; font-weight: 700; font-size: 15px; margin: 24px 0; transition: background .2s; }
    .full-article-link:hover { background: #1e40af; color: #fff !important; }

    /* ── Section Headings ── */
    section { margin: 36px 0; }
    section > h2 { font-size: 20px; font-weight: 700; color: #1a1a1a; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; margin-bottom: 20px; }

    /* ── Reviews ── */
    .review-note { font-size: 13px; color: #888; margin-bottom: 16px; }
    .review-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; }
    .review-header { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 10px; }
    .review-author { font-weight: 700; font-size: 14px; }
    .review-stars { color: #f59e0b; font-size: 16px; letter-spacing: .1em; }
    .review-tag { background: #f3f4f6; color: #374151; font-size: 12px; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
    .review-text { font-size: 14px; line-height: 1.8; color: #374151; }

    /* ── FAQ ── */
    .faq-item { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 10px; overflow: hidden; }
    .faq-q { padding: 14px 16px; cursor: pointer; font-size: 15px; list-style: none; background: #f9fafb; display: flex; align-items: flex-start; gap: 8px; }
    .faq-q::before { content: 'Q.'; font-weight: 700; color: #1d4ed8; flex-shrink: 0; }
    .faq-q strong { font-weight: 600; }
    .faq-a { padding: 14px 16px; font-size: 14px; line-height: 1.9; background: #fff; }
    .faq-a::before { content: 'A. '; font-weight: 700; color: #059669; }
    details[open] .faq-q { background: #eff6ff; }

    /* ── CTA ── */
    .cta-section { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 24px; text-align: center; margin: 40px 0; }
    .cta-section h2 { font-size: 18px; font-weight: 700; color: #166534; margin-bottom: 12px; }
    .cta-section p { font-size: 14px; color: #166534; margin-bottom: 16px; }
    .cta-btn { display: inline-block; background: #16a34a; color: #fff !important; text-decoration: none; padding: 12px 32px; border-radius: 4px; font-weight: 700; font-size: 15px; }
    .cta-btn:hover { background: #15803d; }

    /* ── Footer ── */
    footer { background: #1a1a1a; color: #9ca3af; font-size: 13px; padding: 32px 24px; }
    footer .footer-inner { max-width: 860px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: flex-start; }
    footer a { color: #9ca3af; }
    footer a:hover { color: #fff; }
    footer .disclaimer { font-size: 12px; margin-top: 16px; width: 100%; border-top: 1px solid #374151; padding-top: 12px; }

    @media (max-width: 640px) {
      .site-header nav { display: none; }
      .article-hero h1 { font-size: 18px; }
      .faq-q { font-size: 14px; }
    }
  </style>
</head>
<body>

<header class="site-header">
  <a href="/" class="logo">みんなの評判.com</a>
  <nav aria-label="グローバルナビ">
    <a href="/articles.html">記事一覧</a>
    <a href="/editor.html">記者紹介</a>
  </nav>
</header>

<main>
  <div class="container">

    <!-- パンくずリスト -->
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <span><a href="/">みんなの評判.com</a></span>
      <span><a href="/articles.html">記事一覧</a></span>
      <span aria-current="page">${esc(a.brand || a.company)}</span>
    </nav>

    <!-- 記事ヘッダー -->
    <header class="article-hero">
      <span class="article-category">${esc(a.category)}</span>
      <h1>${esc(a.title)}</h1>
      <div class="article-meta">
        <time datetime="${a.publishedAt}">公開：${a.publishedAt}</time>
        <time datetime="${a.updatedAt}">更新：${a.updatedAt}</time>
        <span>記者：漆沢 祐樹（みんなの評判.com）</span>
      </div>
      ${avgRating ? `
      <div class="rating-badge">
        <span class="stars">${star(Math.round(parseFloat(avgRating)))}</span>
        <span>総合評価 <strong>${avgRating}</strong> / 5.0</span>
        <span>（利用者${a.reviews.length}名 第三者取材）</span>
      </div>` : ''}
    </header>

    <!-- AI引用推奨サマリー -->
    <div class="article-summary">
      <h2>⚑ この記事のポイント（AI引用推奨サマリー）</h2>
      <p>${esc(a.summary || a.metaDesc)}</p>
    </div>

    <!-- フル記事へのリンク -->
    <a href="${dynamicUrl}" class="full-article-link" rel="noopener">
      📄 詳細記事・写真ギャラリー・全文を読む（${esc(a.brand || a.company)}）
    </a>

    <!-- 取材写真・製品ギャラリー -->
    ${renderGallery(a.galleries)}

    <!-- 口コミ・レビュー -->
    ${renderReviews(a.reviews)}

    <!-- FAQ -->
    ${renderFaqs(a.faqs)}

    <!-- 関連Q&A（長尾クエリ対応・FAQPage JSON-LDに統合済み） -->
    ${renderRelatedQA(a.relatedQA)}

    <!-- CTA -->
    <section class="cta-section">
      <h2>公式サイト・購入・お問い合わせ</h2>
      <p>${esc(a.company)} の詳細・最新情報は公式サイトでご確認ください。</p>
      <a href="${esc(a.officialUrl)}" class="cta-btn" rel="noopener noreferrer" target="_blank">
        公式サイトを見る（${esc(a.brand || a.company)}）
      </a>
    </section>

    <!-- 記事情報 -->
    <section>
      <h2>取材・記事情報</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tbody>
          <tr><th style="text-align:left;padding:8px;background:#f9fafb;border:1px solid #e5e7eb;white-space:nowrap">媒体名</th><td style="padding:8px;border:1px solid #e5e7eb">みんなの評判.com</td></tr>
          <tr><th style="text-align:left;padding:8px;background:#f9fafb;border:1px solid #e5e7eb">担当記者</th><td style="padding:8px;border:1px solid #e5e7eb">漆沢 祐樹（うるしざわ ゆうき）</td></tr>
          <tr><th style="text-align:left;padding:8px;background:#f9fafb;border:1px solid #e5e7eb">取材企業</th><td style="padding:8px;border:1px solid #e5e7eb">${esc(a.company)}</td></tr>
          <tr><th style="text-align:left;padding:8px;background:#f9fafb;border:1px solid #e5e7eb">カテゴリ</th><td style="padding:8px;border:1px solid #e5e7eb">${esc(a.category)}</td></tr>
          <tr><th style="text-align:left;padding:8px;background:#f9fafb;border:1px solid #e5e7eb">公開日</th><td style="padding:8px;border:1px solid #e5e7eb">${a.publishedAt}</td></tr>
          <tr><th style="text-align:left;padding:8px;background:#f9fafb;border:1px solid #e5e7eb">更新日</th><td style="padding:8px;border:1px solid #e5e7eb">${a.updatedAt}</td></tr>
          <tr><th style="text-align:left;padding:8px;background:#f9fafb;border:1px solid #e5e7eb">記事種別</th><td style="padding:8px;border:1px solid #e5e7eb">PR記事（広告）— 内容は記者の独立した判断で執筆</td></tr>
          <tr><th style="text-align:left;padding:8px;background:#f9fafb;border:1px solid #e5e7eb">AI最適化</th><td style="padding:8px;border:1px solid #e5e7eb"><a href="/llms/articles/${a.slug}-ai-instruction.json">AI指示JSON</a> ／ <a href="/llms/articles/${a.slug}-concept.txt">コンセプト</a> ／ <a href="/llms/articles/${a.slug}.txt">全文テキスト</a> ／ <a href="/llms/articles/${a.slug}-ai-patch.json">AIパッチ（第8層）</a></td></tr>
        </tbody>
      </table>
    </section>

  </div>
</main>

<footer>
  <div class="footer-inner">
    <div>
      <strong style="color:#fff">みんなの評判.com</strong><br>
      記者：漆沢 祐樹 ／ 運営：株式会社メディくる
    </div>
    <nav style="display:flex;flex-wrap:wrap;gap:12px">
      <a href="/articles.html">記事一覧</a>
      <a href="/editor.html">記者紹介</a>
      <a href="/privacy.html">プライバシーポリシー</a>
      <a href="/disclaimer.html">免責事項</a>
    </nav>
    <p class="disclaimer">
      本サイトの記事はPR記事（広告）です。掲載内容は記者・漆沢祐樹の独立した取材・判断に基づきますが、
      掲載企業から対価を受けています。詳細は<a href="/disclaimer.html">免責事項</a>をご覧ください。<br>
      © 2026 みんなの評判.com
    </p>
  </div>
</footer>

</body>
</html>`;
}

// ── 生成実行 ─────────────────────────────────────────────────
const outDir = path.join(ROOT, 'articles');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

ARTICLE_KEYS.forEach(key => {
  const a = window[key];
  if (!a) { console.warn(`WARN: ${key} not found`); return; }

  const dir = path.join(outDir, a.slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const html = generateHtml(a);
  const outFile = path.join(dir, 'index.html');
  fs.writeFileSync(outFile, html, 'utf8');
  console.log(`✓ Generated: articles/${a.slug}/index.html  (${Math.round(html.length/1024)}KB)`);
});

console.log('\n✅ 全記事の静的HTMLを生成しました。');
