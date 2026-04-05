/**
 * ================================================================
 *  article-renderer.js
 *  URL: article.html?id=<slug>
 *  data/articles.js の該当データを読み込んでDOMを生成する
 * ================================================================
 */

/* ============================================================
   UTILS（main.js と共通ロジック、独立して動作）
============================================================ */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 記事データに画像URLが無い場合の仮画像（images/placeholders/） */
const PLACEHOLDER_IMG = {
  editor: 'images/placeholders/avatar-reporter.svg',
  story: 'images/placeholders/story-portrait.svg',
  gallery: 'images/placeholders/gallery-photo.svg',
  before: 'images/placeholders/gallery-before.svg',
  after: 'images/placeholders/gallery-after.svg',
  media: 'images/placeholders/media-logo.svg',
  og: 'images/placeholders/og-career.svg',
};

const CONTACT_MAILTO = 'mailto:info@minnano-hyouban.com';

function resolveOfficialUrl(u) {
  const raw = String(u || '').trim();
  if (!raw || raw === '#') return { href: CONTACT_MAILTO, source: 'fallback_mailto' };
  try {
    // Normalize to absolute URL (relative is allowed).
    const abs = new URL(raw, window.location.href).href;
    return { href: abs, source: 'official_url' };
  } catch {
    return { href: CONTACT_MAILTO, source: 'fallback_mailto' };
  }
}

/** GA4 測定IDの形式チェック（誤設定で gtag を読み込まない） */
function validGa4MeasurementId(id) {
  return typeof id === 'string' && /^G-[A-Z0-9]{6,}$/.test(id.trim());
}

/**
 * 公式サイトCTA用に UTM をマージ（docs/outbound-tracking-guide.md）
 * window.__OFFICIAL_LINK_UTM__ === false で無効化。
 * オブジェクトで { utm_campaign: 'review_2026' } など上書き可能。
 */
function applyOfficialUtm(absHref, article) {
  const flag = window.__OFFICIAL_LINK_UTM__;
  if (flag === false) return absHref;

  const defaults = {
    utm_source: 'minnano-hyouban',
    utm_medium: 'referral',
    utm_campaign: 'review_article',
    utm_content: String(article?.slug || '').trim() || undefined,
  };
  const overrides = flag && typeof flag === 'object' ? flag : {};

  try {
    const u = new URL(absHref);
    const params = new URLSearchParams(u.search);
    const merged = { ...defaults, ...overrides };
    Object.entries(merged).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') params.set(k, String(v).trim());
    });
    u.search = params.toString();
    return u.href;
  } catch {
    return absHref;
  }
}

function analyticsConsentEnabled() {
  // CMPがないため、明示設定がなければ許可扱いにして計測が止まらないようにする
  // （必要なら localStorage('analytics_consent') を 'false' にして停止可能）
  try {
    const v = localStorage.getItem('analytics_consent');
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

function trackEvent(eventName, params = {}) {
  if (!analyticsConsentEnabled()) return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...params });
  } catch {
    // dataLayer が使えない環境でも落とさない
  }

  // 将来GA4（gtag.js）を後から差し込む場合にも互換を持たせる
  if (typeof window.gtag === 'function') {
    try { window.gtag('event', eventName, params); } catch {}
  }
}

let ga4InitOnce = false;
function maybeInitGA4() {
  if (ga4InitOnce) return;
  ga4InitOnce = true;

  if (!analyticsConsentEnabled()) return;

  const idFromGlobal = window.__GA4_MEASUREMENT_ID__;
  const idFromMeta = document.querySelector('meta[name="ga4-measurement-id"]')?.content;
  const measurementId = (idFromGlobal || idFromMeta || '').trim();
  if (!validGa4MeasurementId(measurementId)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });
}

function galleryServiceForArticle(a) {
  const g = a.galleries?.service;
  if (g && g.length) return g;
  return [
    { src: PLACEHOLDER_IMG.gallery, alt: 'サービス環境（仮）', caption: '取材写真・差し替え予定（1）' },
    { src: PLACEHOLDER_IMG.gallery, alt: 'サービス環境（仮）', caption: '取材写真・差し替え予定（2）' },
    { src: PLACEHOLDER_IMG.gallery, alt: 'サービス環境（仮）', caption: '取材写真・差し替え予定（3）' },
  ];
}

function galleryBeforeAfterForArticle(a) {
  const g = a.galleries?.beforeAfter;
  if (g && g.length) return g;
  return [
    { src: PLACEHOLDER_IMG.before, alt: 'ビフォー（仮）', label: '利用前' },
    { src: PLACEHOLDER_IMG.after, alt: 'アフター（仮）', label: '利用後（仮）' },
  ];
}

function galleryMediaForArticle(a) {
  const g = a.galleries?.media;
  if (g && g.length) return g;
  return [
    { src: PLACEHOLDER_IMG.media, alt: 'メディア掲載（仮）' },
    { src: PLACEHOLDER_IMG.media, alt: 'メディア掲載（仮）' },
    { src: PLACEHOLDER_IMG.media, alt: 'メディア掲載（仮）' },
  ];
}

function starsHTML(count, max = 5) {
  let html = '';
  for (let i = 1; i <= max; i++) html += i <= count ? '★' : '☆';
  return html;
}

function setMeta(name, content, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** フッター SNS（X / LINE）を現在のページURL・タイトルに合わせる */
function updateFooterShareLinks() {
  const wrap = document.querySelector('.footer-sns');
  if (!wrap) return;
  const u = encodeURIComponent(window.location.href);
  const t = encodeURIComponent(document.title);
  const tw = wrap.querySelector('a[aria-label*="X"]') || wrap.querySelector('a');
  const line = wrap.querySelector('a[aria-label*="LINE"]');
  if (tw) tw.href = `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
  if (line) line.href = `https://line.me/R/share?url=${u}`;
}

/* ============================================================
   BUILD ARTICLE HTML
============================================================ */
function buildArticleHTML(a) {
  const resolved = resolveOfficialUrl(a.officialUrl);
  const cta =
    resolved.source === 'official_url'
      ? { href: applyOfficialUtm(resolved.href, a), source: resolved.source }
      : resolved;
  const hasOfficial = cta.source === 'official_url';
  const isMailto = String(cta.href).startsWith('mailto:');
  const ctaLinkAttrs = isMailto ? '' : ' target="_blank" rel="noopener noreferrer"';
  const mailInquiry = `${CONTACT_MAILTO}?subject=${encodeURIComponent(`お問い合わせ（${a.company || '記事'}）`)}`;

  // Service cards
  const serviceCardsHTML = (a.serviceCards || []).map(c => `
    <div class="service-card" role="listitem">
      <span class="service-icon" aria-hidden="true">${esc(c.icon)}</span>
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.text)}</p>
    </div>
  `).join('');

  // Steps
  const stepsHTML = (a.steps || []).map((s, i) => `
    <li class="step-item">
      <div class="step-num" aria-label="ステップ${i + 1}">STEP<br><strong>${i + 1}</strong></div>
      <div class="step-content">
        <h4>${esc(s.title)}</h4>
        <p>${esc(s.text)}</p>
      </div>
    </li>
  `).join('');

  // Gallery service slides
  const serviceSlides = galleryServiceForArticle(a).map(img => `
    <div class="swiper-slide">
      <figure class="slide-figure">
        <img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy">
        <figcaption>${esc(img.caption)}</figcaption>
      </figure>
    </div>
  `).join('');

  // Gallery before/after slides
  const baSlides = galleryBeforeAfterForArticle(a).map(img => `
    <div class="swiper-slide">
      <figure class="ba-figure">
        <img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy">
        <span class="ba-label">${esc(img.label)}</span>
      </figure>
    </div>
  `).join('');

  // Media logos
  const mediaLogos = galleryMediaForArticle(a).map(m => `
    <div class="media-logo-wrap" role="listitem">
      <img src="${esc(m.src)}" alt="${esc(m.alt)}" class="media-logo" loading="lazy" height="32">
    </div>
  `).join('');

  // Story paragraphs
  const storyParas = (a.storyText || []).map(p => `<p>${esc(p)}</p>`).join('');

  // Check items
  const checkItems = (a.checkItems || []).map(item => `
    <li><span class="check-icon" aria-hidden="true">✓</span> ${esc(item)}</li>
  `).join('');

  // Feature boxes (01〜04)
  const featureBoxesHTML = (a.featureBoxes || []).map((fb, i) => `
    <div class="feature-box">
      <span class="feature-box-num">${String(i + 1).padStart(2, '0')}</span>
      <h3>${esc(fb.title)}</h3>
      <p>${esc(fb.text)}</p>
    </div>
  `).join('');

  // Score breakdown bars
  const scoreBarsHTML = (a.scoreDetails || []).map(s => {
    const pct = Math.round((s.score / (s.max || 5)) * 100);
    return `
      <div class="score-bar-row" style="--bar-pct:${pct}%">
        <span class="bar-label">${esc(s.label)}</span>
        <div class="bar-track" role="progressbar" aria-valuenow="${s.score}" aria-valuemin="0" aria-valuemax="${s.max || 5}">
          <div class="bar-fill"></div>
        </div>
        <span class="bar-value">${s.score}<small>/${s.max || 5}</small></span>
      </div>
    `;
  }).join('');

  // Interviews
  const interviewsHTML = (a.interviews || []).map(iv => {
    const qaHTML = (iv.qa || []).map(item => `
      <div class="qa-row">
        <p class="qa-q">${esc(item.q)}</p>
        <p class="qa-a">${esc(item.a)}</p>
      </div>
    `).join('');
    const badgeClass = iv.resultType === 'success' ? 'result-badge result-success' : 'result-badge result-other';
    return `
      <div class="interview-card">
        <div class="interviewee-header">
          <div class="interviewee-avatar" aria-hidden="true">${esc((iv.name || '？').charAt(0))}</div>
          <div>
            <p class="interviewee-name">${esc(iv.name || '')}</p>
            <p class="interviewee-bg">${esc(iv.bg || '')}</p>
          </div>
          <span class="${badgeClass}">${esc(iv.resultLabel || '')}</span>
        </div>
        <div class="interview-qa">${qaHTML}</div>
        ${iv.obs ? `<p class="reporter-obs">${esc(iv.obs)}</p>` : ''}
      </div>
    `;
  }).join('');

  // Journalist cut-in QA
  const cuttingQAHTML = (a.cuttingQA || []).map(item => `
    <li class="cutting-qa-item">
      <p class="cutting-q"><span class="cutting-q-who">${esc(item.who || '記者')}</span>${esc(item.q)}</p>
      <p class="cutting-a">${esc(item.a)}</p>
    </li>
  `).join('');

  const cuttingSummaryHTML = a.cuttingSummary
    ? `<div class="cutting-verdict">
        <p class="cutting-summary-label">${esc(a.cuttingSummary.label || '記者の総評')}</p>
        <p class="cutting-summary">${esc(a.cuttingSummary.text || '')}</p>
       </div>`
    : '';

  return `
    <!-- 01 HERO -->
    <section class="hero" aria-labelledby="hero-heading">
      <div class="hero-inner">
        <span class="hero-tag" aria-label="注目情報">${esc(a.heroTag || '大手ネットニュースでも話題！')}</span>
        <h1 class="hero-title" id="hero-heading">${a.heroTitle || esc(a.company) + 'の評判を<br>徹底調査しました'}</h1>
        <p class="hero-sub">${esc(a.heroSub || '')}</p>
        <ul class="hero-badges" role="list" aria-label="記事の特徴">
          <li class="badge-media">大手ニュース掲載企業</li>
          <li>第三者取材</li>
          <li>記者執筆</li>
          <li>口コミ多数掲載</li>
        </ul>
        <a href="#reviews" class="btn btn--hero">お客様の声を読む</a>
        <p class="hero-pr-note">※本記事はPR・広告を含みます</p>
      </div>
    </section>

    <!-- 02 EDITOR'S NOTE -->
    <section class="editors-note animate-on-scroll" aria-labelledby="note-heading">
      <div class="container">
        <div class="note-card">
          <span class="pr-badge" aria-label="本記事は広告・PR記事です">PR</span>
          <div class="editor-profile">
            <img src="${esc(a.editorImg || PLACEHOLDER_IMG.editor)}"
                 alt="${esc(a.editorName || '記者')}の顔写真" class="editor-avatar" loading="lazy" width="64" height="64">
            <div>
              <p class="editor-name">${esc(a.editorName || '記者：漆沢 祐樹')}</p>
              <p class="editor-title">${esc(a.editorTitle || '株式会社パーソナルナビ/ 株式会社メディくる 代表取締役／みんなの評判.com 担当記者')}</p>
            </div>
          </div>
          <div class="note-checklist">
            <p class="checklist-heading" id="note-heading">この記事で分かること</p>
            <ul role="list">${checkItems}</ul>
          </div>
        </div>
      </div>
    </section>

    <!-- 03 ARTICLE BODY: reporter note + feature boxes + journalist take -->
    ${a.reporterNote ? `
    <section class="body-section animate-on-scroll" aria-label="記者コメント">
      <div class="container">
        <div class="reporter-note-card">
          <p class="reporter-note-text">${esc(a.reporterNote)}</p>
        </div>
      </div>
    </section>` : ''}

    ${featureBoxesHTML ? `
    <section class="body-section animate-on-scroll" aria-labelledby="features-heading">
      <div class="container">
        <h2 class="section-title" id="features-heading">取材で見えた注目ポイント</h2>
        <div class="feature-boxes" role="list">${featureBoxesHTML}</div>
      </div>
    </section>` : ''}

    ${a.journalistTake ? `
    <section class="body-section animate-on-scroll" aria-label="記者の見解">
      <div class="container">
        <div class="journalist-take">
          <p>${esc(a.journalistTake)}</p>
        </div>
      </div>
    </section>` : ''}

    <!-- G1 SERVICE GALLERY  [画像: 800×600px / 横3枚スライダー] -->
    <section class="gallery-section animate-on-scroll" id="gallery-service" aria-labelledby="gallery-service-heading">
      <div class="container">
        <h2 class="section-title" id="gallery-service-heading">サービスの雰囲気をご覧ください</h2>
        <div class="swiper swiper-service" aria-label="サービスイメージスライダー">
          <div class="swiper-wrapper">${serviceSlides}</div>
          <div class="swiper-pagination" aria-label="スライドページネーション"></div>
        </div>
      </div>
    </section>

    <!-- 04 SCORE BREAKDOWN -->
    ${scoreBarsHTML ? `
    <section class="score-breakdown animate-on-scroll" aria-labelledby="score-heading">
      <div class="container">
        <h2 class="section-title" id="score-heading">記者が評価した5つの指標</h2>
        <div class="score-bars">${scoreBarsHTML}</div>
        ${a.scoreNote ? `<p class="score-note">${esc(a.scoreNote)}</p>` : ''}
      </div>
    </section>` : ''}

    <!-- 05 INTERVIEWS -->
    ${interviewsHTML ? `
    <section class="interview-section animate-on-scroll" aria-labelledby="interview-heading">
      <div class="container">
        <h2 class="section-title" id="interview-heading">取材協力者のリアルな声</h2>
        <p class="section-sub">記者が直接インタビューした利用者の証言です</p>
        ${interviewsHTML}
      </div>
    </section>` : ''}

    <!-- 06 REVIEWS -->
    <section class="reviews-section animate-on-scroll" id="reviews" aria-labelledby="reviews-heading">
      <div class="container">
        <h2 class="section-title" id="reviews-heading">実際に利用したお客様の声</h2>
        <p class="section-sub">記者が直接ヒアリングした本音の声をお届けします</p>
        <div class="reviews-grid" id="reviews-grid" aria-label="レビュー一覧" role="list"></div>
      </div>
    </section>

    <!-- G2 BEFORE/AFTER  [画像: 600×400px / 2枚スライダー] -->
    <section class="gallery-section gallery-ba animate-on-scroll" id="gallery-before-after" aria-labelledby="gallery-ba-heading">
      <div class="container">
        <h2 class="section-title" id="gallery-ba-heading">利用者の変化をご覧ください</h2>
        <div class="swiper swiper-ba" aria-label="ビフォーアフタースライダー">
          <div class="swiper-wrapper">${baSlides}</div>
          <div class="swiper-button-prev" aria-label="前のスライドへ"></div>
          <div class="swiper-button-next" aria-label="次のスライドへ"></div>
        </div>
      </div>
    </section>

    <!-- 07 JOURNALIST CUT-IN Q&A -->
    ${cuttingQAHTML ? `
    <section class="cutting-section animate-on-scroll" aria-labelledby="cutting-heading">
      <div class="container">
        ${a.cuttingIntro ? `<p class="cutting-intro" id="cutting-heading">${esc(a.cuttingIntro)}</p>` : '<h2 class="section-title" id="cutting-heading">記者が直接切り込んだ質問</h2>'}
        <ul class="cutting-qa-list" role="list">${cuttingQAHTML}</ul>
        ${cuttingSummaryHTML}
      </div>
    </section>` : ''}

    <!-- 08 SERVICE DETAILS -->
    <section class="service-section animate-on-scroll" aria-labelledby="service-heading">
      <div class="container">
        <h2 class="section-title" id="service-heading">サービス概要</h2>
        <div class="service-grid" role="list">${serviceCardsHTML}</div>
        <div class="steps-wrapper" aria-labelledby="steps-heading">
          <h3 class="steps-heading" id="steps-heading">ご利用の流れ</h3>
          <ol class="steps-list">${stepsHTML}</ol>
        </div>
      </div>
    </section>

    <!-- 09 FAQ -->
    <section class="faq-section animate-on-scroll" aria-labelledby="faq-heading">
      <div class="container">
        <h2 class="section-title" id="faq-heading">よくある疑問</h2>
        <dl class="faq-list" id="faq-list"></dl>
      </div>
    </section>

    <!-- G3 MEDIA  [画像: 120×40px / ロゴ横並び] -->
    <section class="media-section animate-on-scroll" id="gallery-media" aria-labelledby="media-heading">
      <div class="container">
        <h2 class="section-title" id="media-heading">メディア掲載実績</h2>
        <div class="media-logos" role="list" aria-label="掲載メディア一覧">${mediaLogos}</div>
      </div>
    </section>

    <!-- 10 STORY -->
    <section class="story-section animate-on-scroll" aria-labelledby="story-heading">
      <div class="container">
        <h2 class="section-title" id="story-heading">このメディアを始めた理由</h2>
        <div class="story-content">
          <img src="${esc(a.storyImg || PLACEHOLDER_IMG.story)}"
               alt="${esc(a.storyAlt || '代表者の写真')}" class="story-img" loading="lazy" width="200" height="200">
          <blockquote class="story-quote">${storyParas}</blockquote>
        </div>
      </div>
    </section>

    <!-- 11 CTA -->
    <section class="cta-section animate-on-scroll" id="contact" aria-labelledby="cta-heading">
      <div class="container">
        <h2 class="cta-title" id="cta-heading">${esc(a.ctaTitle || 'この評判記事が気になった方へ')}</h2>
        <p class="cta-sub">${esc(
          hasOfficial
            ? (a.ctaSub || 'まずは公式サイトで詳細をご確認ください。')
            : (a.ctaSub || '公式サイトの案内URLが未登録のため、メディアへのお問い合わせからご案内します。')
        )}</p>
        ${hasOfficial ? `
        <a href="${esc(cta.href)}"
           class="btn btn--cta"
           ${ctaLinkAttrs}
           data-cta-kind="article_official"
           data-article-slug="${esc(a.slug || '')}"
           data-company="${esc(a.company || '')}"
           data-cta-source="${esc(cta.source)}"
        >${esc(a.ctaBtn || '公式サイトを確認する →')}</a>
        <a href="${esc(cta.href)}"
           class="btn-text-link"
           ${ctaLinkAttrs}
           data-cta-kind="article_contact"
           data-article-slug="${esc(a.slug || '')}"
           data-company="${esc(a.company || '')}"
           data-cta-source="${esc(cta.source)}"
        >無料相談・お問い合わせはこちら</a>
        ` : `
        <p class="cta-fallback-note" role="note">※ 公式サイトの公開URLが未設定です。メディア経由でのご案内となります。</p>
        <a href="${esc(mailInquiry)}"
           class="btn btn--cta"
           data-cta-kind="article_official"
           data-article-slug="${esc(a.slug || '')}"
           data-company="${esc(a.company || '')}"
           data-cta-source="fallback_mailto"
        >メディアへのお問い合わせ</a>
        <a href="index.html#contact"
           class="btn-text-link"
           data-cta-kind="article_media_inquiry"
           data-article-slug="${esc(a.slug || '')}"
           data-company="${esc(a.company || '')}"
        >取材・掲載のご依頼（メディア）</a>
        `}
      </div>
    </section>
  `;
}

/* ============================================================
   RENDER REVIEWS (article page)
============================================================ */
function renderReviewsInArticle(list) {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  list.forEach((r) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${esc(r.name)}さんのレビュー`);

    card.innerHTML = `
      <div class="review-card-header">
        <div class="review-avatar" aria-hidden="true">${esc(r.name.charAt(0))}</div>
        <div class="review-meta">
          <p class="review-name">${esc(r.name)}</p>
          <p class="review-age">${esc(r.age)}</p>
        </div>
        <span class="review-tag">${esc(r.tag)}</span>
      </div>
      <p class="review-stars" aria-label="評価：${r.stars}点（5点満点）">${starsHTML(r.stars)}</p>
      <p class="review-text">${esc(r.text)}</p>
    `;

    grid.appendChild(card);
  });
}

/* ============================================================
   RENDER FAQ (article page)
============================================================ */
function renderFAQInArticle(list) {
  const dl = document.getElementById('faq-list');
  if (!dl) return;

  list.forEach((item, i) => {
    const id = `faq-answer-${i}`;
    const div = document.createElement('div');
    div.className = 'faq-item';

    const dt = document.createElement('dt');
    dt.innerHTML = `
      <button class="faq-question" aria-expanded="false" aria-controls="${id}" id="faq-q-${i}">
        <span class="faq-q-label" aria-hidden="true">Q</span>
        <span class="faq-question-text">${esc(item.q)}</span>
        <span class="faq-icon" aria-hidden="true">+</span>
      </button>
    `;

    const dd = document.createElement('dd');
    dd.id = id;
    dd.className = 'faq-answer-wrapper';
    dd.setAttribute('role', 'region');
    dd.setAttribute('aria-labelledby', `faq-q-${i}`);
    dd.innerHTML = `<div class="faq-answer"><span class="faq-a-label" aria-hidden="true">A</span>${esc(item.a)}</div>`;

    div.appendChild(dt);
    div.appendChild(dd);
    dl.appendChild(div);

    const btn = dt.querySelector('.faq-question');
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      dd.style.maxHeight = isOpen ? '0' : dd.scrollHeight + 'px';
    });
  });
}

/* ============================================================
   HAMBURGER
============================================================ */
function initHamburger() {
  const btn = document.querySelector('.hamburger');
  const nav = document.getElementById('nav-mobile');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!isOpen));
    btn.setAttribute('aria-label', isOpen ? 'メニューを開く' : 'メニューを閉じる');
    nav.hidden = isOpen;
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      btn.setAttribute('aria-expanded', 'false');
      nav.hidden = true;
    });
  });

  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      btn.setAttribute('aria-expanded', 'false');
      nav.hidden = true;
    }
  });
}

/* ============================================================
   SMOOTH SCROLL
============================================================ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href').slice(1);
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;
      e.preventDefault();
      const headerH = document.querySelector('.site-header')?.offsetHeight || 60;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - headerH - 8, behavior: 'smooth' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });
}

/* ============================================================
   SCORE BAR ANIMATION
============================================================ */
function initScoreBars() {
  const rows = document.querySelectorAll('.score-bar-row[style]');
  if (!rows.length) return;

  if (!('IntersectionObserver' in window)) {
    rows.forEach(row => row.classList.add('bar-animated'));
    return;
  }

  const ob = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const row = e.target;
      const idx = Array.from(rows).indexOf(row);
      setTimeout(() => row.classList.add('bar-animated'), idx * 120);
      ob.unobserve(row);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -30px 0px' });

  rows.forEach(row => ob.observe(row));
}

/* ============================================================
   INTERSECTION OBSERVER
============================================================ */
function initScrollAnimations() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.animate-on-scroll').forEach(el => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

/* ============================================================
   SWIPER INIT
============================================================ */
function initSwipers() {
  if (document.querySelector('.swiper-service')) {
    new Swiper('.swiper-service', {
      loop: true,
      slidesPerView: 1.3,
      spaceBetween: 16,
      centeredSlides: true,
      pagination: { el: '.swiper-service .swiper-pagination', clickable: true },
      breakpoints: { 768: { slidesPerView: 3, centeredSlides: false, spaceBetween: 20 } },
      a11y: { prevSlideMessage: '前のスライド', nextSlideMessage: '次のスライド' }
    });
  }
  if (document.querySelector('.swiper-ba')) {
    new Swiper('.swiper-ba', {
      slidesPerView: 1,
      spaceBetween: 20,
      navigation: { nextEl: '.swiper-ba .swiper-button-next', prevEl: '.swiper-ba .swiper-button-prev' },
      breakpoints: { 768: { slidesPerView: 2 } },
      a11y: { prevSlideMessage: '前のスライド', nextSlideMessage: '次のスライド' }
    });
  }
}

/* ============================================================
   MAIN ENTRY POINT
============================================================ */
/* ============================================================
   404 / ERROR HELPERS
============================================================ */

/** ページを noindex に切り替える */
function setNoIndex() {
  let el = document.querySelector('meta[name="robots"]');
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    document.head.appendChild(el);
  }
  el.setAttribute('content', 'noindex, nofollow');
}

/** 最近の記事（最大 n 件）の HTML を返す。候補がない場合は空文字 */
function buildSuggestionsHTML(articles, currentSlug, n = 3) {
  const candidates = (Array.isArray(articles) ? articles : [])
    .filter(a => a.slug && a.slug !== currentSlug && a.heroTitle)
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
    .slice(0, n);

  if (!candidates.length) return '';

  const items = candidates.map(s => `
    <li>
      <a href="article.html?id=${esc(s.slug)}" class="not-found-suggestion-link">
        <span class="not-found-suggestion-cat">${esc(s.category || '')}</span>${esc(s.company || s.title || '')}
      </a>
    </li>
  `).join('');

  return `
    <div class="not-found-suggestions">
      <p class="not-found-suggestions-title">最近の記事</p>
      <ul class="not-found-suggestions-list">${items}</ul>
    </div>
  `;
}

/** 記事が見つからない場合の UI を描画する */
function renderArticleNotFound(main, articles, slug) {
  document.title = '記事が見つかりません | みんなの評判.com';
  setNoIndex();

  main.innerHTML = `
    <div class="article-not-found container" role="alert" aria-live="assertive">
      <div class="not-found-code" aria-hidden="true">404</div>
      <h1 class="not-found-title">記事が見つかりませんでした</h1>
      <p class="not-found-lead">
        お探しの記事（<code>${esc(slug)}</code>）は存在しないか、<br>
        URLが間違っている可能性があります。
      </p>
      <div class="not-found-actions">
        <a href="articles.html" class="btn btn--primary">記事一覧を見る</a>
        <a href="index.html" class="btn btn--secondary">トップへ戻る</a>
      </div>
      ${buildSuggestionsHTML(articles, slug)}
    </div>
  `;
  updateFooterShareLinks();
}

/** データファイル読み込み失敗時の UI を描画する */
function renderDataLoadError(main) {
  document.title = '読み込みエラー | みんなの評判.com';
  setNoIndex();

  main.innerHTML = `
    <div class="article-not-found container" role="alert" aria-live="assertive">
      <div class="not-found-code" aria-hidden="true">エラー</div>
      <h1 class="not-found-title">記事データを読み込めませんでした</h1>
      <p class="not-found-lead">
        ネットワーク障害または一時的なエラーが発生しました。<br>
        ページを再読み込みするか、しばらく経ってから再度お試しください。
      </p>
      <div class="not-found-actions">
        <button class="btn btn--primary not-found-reload-btn" onclick="window.location.reload()">再読み込み</button>
        <a href="articles.html" class="btn btn--secondary">記事一覧へ</a>
      </div>
    </div>
  `;
  updateFooterShareLinks();
}

/* ============================================================
   MAIN ENTRY POINT
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initHamburger();

  const main = document.getElementById('article-main');

  // ── シナリオ①: data/articles.js が未定義または非配列（スクリプト読み込みエラー）
  if (!Array.isArray(window.ARTICLES)) {
    renderDataLoadError(main);
    return;
  }

  const articles = window.ARTICLES;

  // ── シナリオ②: ?id= パラメータなし → 記事一覧へリダイレクト
  const params = new URLSearchParams(window.location.search);
  const slug = (params.get('id') || '').trim();

  if (!slug) {
    window.location.replace('articles.html');
    return;
  }

  // ── シナリオ③: slug が見つからない（記事 404）
  const article = articles.find(a => a.slug === slug);

  if (!article) {
    renderArticleNotFound(main, articles, slug);
    return;
  }

  // Update page meta
  document.title = article.title || `${article.company}の評判 | みんなの評判.com`;
  setMeta('description', article.metaDesc || '');
  setMeta('og:title', article.title || '', 'property');
  setMeta('og:description', article.metaDesc || '', 'property');
  function ogImageAbsolute(u) {
    const path = u || PLACEHOLDER_IMG.og;
    try {
      return new URL(path, window.location.href).href;
    } catch {
      return path;
    }
  }
  setMeta('og:image', ogImageAbsolute(article.ogImage), 'property');

  /* ============================================================
     JSON-LD（構造化データ）
     - 記事ページに Article / BreadcrumbList / FAQPage を付与
     - 記者（漆沢祐樹）は「公開前提（要ファクトチェック）」で最小限の項目のみ反映
  ============================================================ */
  function upsertJSONLD(id, obj) {
    const json = JSON.stringify(obj);
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = json;
  }

  function stripHTML(str) {
    return String(str || '').replace(/<[^>]*>/g, '');
  }

  const pageUrl = new URL(window.location.href).href;
  const siteOrigin = window.location.origin;

  // TODO: 公開可能項目の最終ファクトチェック（schemaに入れる項目は最小限）
  const authorPerson = {
    '@type': 'Person',
    name: '漆沢 祐樹',
    jobTitle: '株式会社パーソナルナビ／株式会社メディくる 代表取締役',
    worksFor: { '@type': 'Organization', name: '株式会社パーソナルナビ' },
    sameAs: ['https://thecareer.jp', 'https://humanstory.jp'],
    knowsAbout: [
      'キャリア教育',
      '人材紹介',
      '企業研修',
      '浮世絵外交',
      '国際芸術文化協会'
    ]
  };

  const publisherOrg = {
    '@type': 'Organization',
    name: 'みんなの評判.com',
    url: new URL('./', siteOrigin).href
  };

  const ogImgAbs = ogImageAbsolute(article.ogImage);
  const breadcrumbLD = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: new URL('/index.html', siteOrigin).href },
      { '@type': 'ListItem', position: 2, name: '記事一覧', item: new URL('/articles.html', siteOrigin).href },
      { '@type': 'ListItem', position: 3, name: stripHTML(article.company || article.title || ''), item: pageUrl }
    ]
  };

  const articleLD = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    headline: stripHTML(article.heroTitle || article.title || ''),
    description: article.metaDesc || '',
    image: ogImgAbs,
    articleSection: article.category || undefined,
    inLanguage: 'ja-JP',
    datePublished: article.publishedAt || undefined,
    dateModified: article.updatedAt || article.publishedAt || undefined,
    author: authorPerson,
    publisher: publisherOrg
  };

  upsertJSONLD('jsonld-breadcrumb', breadcrumbLD);
  upsertJSONLD('jsonld-article', articleLD);

  if (Array.isArray(article.faqs) && article.faqs.length > 0) {
    const faqLD = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: article.faqs.slice(0, 10).map(item => ({
        '@type': 'Question',
        name: stripHTML(item.q || ''),
        acceptedAnswer: {
          '@type': 'Answer',
          text: stripHTML(item.a || '')
        }
      }))
    };
    upsertJSONLD('jsonld-faq', faqLD);
  }

  // Render article
  main.innerHTML = buildArticleHTML(article);
  updateFooterShareLinks();

  // CTA click tracking（指名検索→記事→公式遷移の計測を想定）
  maybeInitGA4();
  main.querySelectorAll('a[data-cta-kind]').forEach((a) => {
    a.addEventListener('click', () => {
      trackEvent('article_cta_click', {
        cta_kind: a.dataset.ctaKind,
        article_slug: a.dataset.articleSlug,
        company: a.dataset.company,
        cta_source: a.dataset.ctaSource,
        page_url: window.location.href,
      });
    }, { capture: true, passive: true });
  });

  // Post-render: reviews, FAQ, animations, swipers
  renderReviewsInArticle(article.reviews || []);
  renderFAQInArticle(article.faqs || []);
  initSmoothScroll();
  initScoreBars();
  initScrollAnimations();
  requestAnimationFrame(() => initSwipers());
});
