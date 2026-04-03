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

/* ============================================================
   BUILD ARTICLE HTML
============================================================ */
function buildArticleHTML(a) {
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
  const serviceSlides = (a.galleries?.service || []).map(img => `
    <div class="swiper-slide">
      <figure class="slide-figure">
        <img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy">
        <figcaption>${esc(img.caption)}</figcaption>
      </figure>
    </div>
  `).join('');

  // Gallery before/after slides
  const baSlides = (a.galleries?.beforeAfter || []).map(img => `
    <div class="swiper-slide">
      <figure class="ba-figure">
        <img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy">
        <span class="ba-label">${esc(img.label)}</span>
      </figure>
    </div>
  `).join('');

  // Media logos
  const mediaLogos = (a.galleries?.media || []).map(m => `
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
      <div class="score-bar-row">
        <span class="bar-label">${esc(s.label)}</span>
        <div class="bar-track" role="progressbar" aria-valuenow="${s.score}" aria-valuemin="0" aria-valuemax="${s.max || 5}">
          <div class="bar-fill bar-animated" style="--bar-width:${pct}%"></div>
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
            <img src="${esc(a.editorImg || 'https://placehold.co/64x64/1a5fa8/ffffff?text=Y')}"
                 alt="${esc(a.editorName || '記者')}の顔写真" class="editor-avatar" loading="lazy" width="64" height="64">
            <div>
              <p class="editor-name">${esc(a.editorName || '記者：漆沢 祐樹')}</p>
              <p class="editor-title">${esc(a.editorTitle || 'フリーランス記者 / 消費者メディア専門')}</p>
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
          <img src="${esc(a.storyImg || 'https://placehold.co/200x200')}"
               alt="${esc(a.storyAlt || '代表者の写真')}" class="story-img" loading="lazy" width="200" height="200">
          <blockquote class="story-quote">${storyParas}</blockquote>
        </div>
      </div>
    </section>

    <!-- 11 CTA -->
    <section class="cta-section animate-on-scroll" id="contact" aria-labelledby="cta-heading">
      <div class="container">
        <h2 class="cta-title" id="cta-heading">${esc(a.ctaTitle || 'この評判記事が気になった方へ')}</h2>
        <p class="cta-sub">${esc(a.ctaSub || 'まずは公式サイトで詳細をご確認ください。')}</p>
        <a href="${esc(a.officialUrl || '#')}" class="btn btn--cta" target="_blank" rel="noopener noreferrer">${esc(a.ctaBtn || '公式サイトを確認する →')}</a>
        <a href="${esc(a.officialUrl || '#')}" class="btn-text-link" target="_blank" rel="noopener noreferrer">無料相談・お問い合わせはこちら</a>
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
document.addEventListener('DOMContentLoaded', () => {
  initHamburger();

  // Get article slug from URL
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('id');

  const main = document.getElementById('article-main');
  const articles = window.ARTICLES || [];

  if (!slug) {
    // No slug → redirect to listing
    window.location.href = 'articles.html';
    return;
  }

  const article = articles.find(a => a.slug === slug);

  if (!article) {
    main.innerHTML = `
      <div class="article-not-found container" role="alert">
        <h2>記事が見つかりませんでした</h2>
        <p style="color:var(--color-muted);margin-top:8px;">お探しの記事は存在しないか、URLが間違っている可能性があります。</p>
        <a href="articles.html" class="btn" style="margin-top:24px;background:var(--color-primary);color:white;">記事一覧へ戻る</a>
      </div>
    `;
    return;
  }

  // Update page meta
  document.title = article.title || `${article.company}の評判 | みんなの評判.com`;
  setMeta('description', article.metaDesc || '');
  setMeta('og:title', article.title || '', 'property');
  setMeta('og:description', article.metaDesc || '', 'property');
  setMeta('og:image', article.ogImage || '', 'property');

  // Render article
  main.innerHTML = buildArticleHTML(article);

  // Post-render: reviews, FAQ, animations, swipers
  renderReviewsInArticle(article.reviews || []);
  renderFAQInArticle(article.faqs || []);
  initSmoothScroll();
  initScrollAnimations();
  requestAnimationFrame(() => initSwipers());
});
