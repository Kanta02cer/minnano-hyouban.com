/**
 * ================================================================
 *  みんなの評判.com — main.js
 * ================================================================
 */

/* ============================================================
   REVIEWS DATA（index.html 用固定データ）
   ※ article.html では articles.js のデータを使用
============================================================ */
const reviews = [
  {
    id: 1, name: "田中 M様", age: "32歳・女性", stars: 5, tag: "効果実感",
    text: "最初は半信半疑でしたが、使ってみて本当によかったです。他の口コミサイトと違い、具体的な体験談が多くて参考になりました。"
  },
  {
    id: 2, name: "佐藤 K様", age: "45歳・男性", stars: 5, tag: "信頼性",
    text: "企業の広告では分からないリアルな情報が載っていて、購入前の不安が解消されました。友人にも勧めています。"
  },
  {
    id: 3, name: "伊藤 A様", age: "28歳・女性", stars: 4, tag: "価格納得",
    text: "料金が少し高いかと思いましたが、サービスの質を考えると納得できました。担当の方の対応も丁寧でした。"
  },
  {
    id: 4, name: "山本 T様", age: "38歳・男性", stars: 4, tag: "使いやすさ",
    text: "初めて利用しましたが、思っていたより使いやすかったです。もう少し早く知りたかった。"
  },
  {
    id: 5, name: "鈴木 E様", age: "41歳・女性", stars: 5, tag: "継続利用",
    text: "友人に勧められて使ってみました。期待以上の結果が出て、今では毎月利用しています。継続するつもりです。"
  }
];

/* ============================================================
   FAQ DATA（index.html 用）
============================================================ */
const faqs = [
  {
    q: "本当に効果はありますか？",
    a: "実際にご利用いただいた方の〇割以上が「満足」とお答えいただいています。個人差はありますが、多くの方に実感していただいています。"
  },
  {
    q: "料金はどのくらいかかりますか？",
    a: "サービス内容によって異なります。詳細は公式サイトのお問い合わせフォームよりご確認ください。"
  },
  {
    q: "初めてでも安心して使えますか？",
    a: "はい、初めての方でも丁寧にサポートいたします。ご不明な点はお気軽にご相談ください。"
  },
  {
    q: "解約・キャンセルはできますか？",
    a: "所定の手続きにより解約が可能です。詳細は公式サイトをご確認ください。"
  },
  {
    q: "この記事は広告ですか？",
    a: "本記事はPR記事です。第三者の記者が取材・編集していますが、掲載費用を企業からいただいています。"
  }
];

/* ============================================================
   UTILS
============================================================ */
function starsHTML(count, max = 5) {
  let html = '';
  for (let i = 1; i <= max; i++) {
    html += i <= count ? '★' : '☆';
  }
  return html;
}

function avatarInitial(name) {
  return name.charAt(0);
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   RENDER REVIEWS
============================================================ */
function renderReviews(list, containerId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  const fragment = document.createDocumentFragment();

  list.forEach((r) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${escapeHTML(r.name)}さんのレビュー`);

    card.innerHTML = `
      <div class="review-card-header">
        <div class="review-avatar" aria-hidden="true">${escapeHTML(avatarInitial(r.name))}</div>
        <div class="review-meta">
          <p class="review-name">${escapeHTML(r.name)}</p>
          <p class="review-age">${escapeHTML(r.age)}</p>
        </div>
        <span class="review-tag">${escapeHTML(r.tag)}</span>
      </div>
      <p class="review-stars" aria-label="評価：${r.stars}点（5点満点）">${starsHTML(r.stars)}</p>
      <p class="review-text">${escapeHTML(r.text)}</p>
    `;

    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

/* ============================================================
   RENDER FAQ
============================================================ */
function renderFAQ(list, containerId) {
  const dl = document.getElementById(containerId);
  if (!dl) return;

  list.forEach((item, i) => {
    const id = `faq-answer-${i}`;

    const div = document.createElement('div');
    div.className = 'faq-item';

    const dt = document.createElement('dt');
    dt.innerHTML = `
      <button
        class="faq-question"
        aria-expanded="false"
        aria-controls="${id}"
        id="faq-q-${i}"
      >
        <span class="faq-q-label" aria-hidden="true">Q</span>
        <span class="faq-question-text">${escapeHTML(item.q)}</span>
        <span class="faq-icon" aria-hidden="true">+</span>
      </button>
    `;

    const dd = document.createElement('dd');
    dd.id = id;
    dd.className = 'faq-answer-wrapper';
    dd.setAttribute('role', 'region');
    dd.setAttribute('aria-labelledby', `faq-q-${i}`);
    dd.innerHTML = `
      <div class="faq-answer">
        <span class="faq-a-label" aria-hidden="true">A</span>${escapeHTML(item.a)}
      </div>
    `;

    div.appendChild(dt);
    div.appendChild(dd);
    dl.appendChild(div);

    // Accordion toggle
    const btn = dt.querySelector('.faq-question');
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      dd.style.maxHeight = isOpen ? '0' : dd.scrollHeight + 'px';
    });
  });
}

/* ============================================================
   SWIPER INIT
============================================================ */
function initSwipers() {
  // G1: Service Gallery
  if (document.querySelector('.swiper-service')) {
    new Swiper('.swiper-service', {
      loop: true,
      slidesPerView: 1.3,
      spaceBetween: 16,
      centeredSlides: true,
      pagination: {
        el: '.swiper-service .swiper-pagination',
        clickable: true,
      },
      breakpoints: {
        768: {
          slidesPerView: 3,
          centeredSlides: false,
          spaceBetween: 20,
        }
      },
      a11y: {
        prevSlideMessage: '前のスライド',
        nextSlideMessage: '次のスライド',
      }
    });
  }

  // G2: Before/After
  if (document.querySelector('.swiper-ba')) {
    new Swiper('.swiper-ba', {
      slidesPerView: 1,
      spaceBetween: 20,
      navigation: {
        nextEl: '.swiper-ba .swiper-button-next',
        prevEl: '.swiper-ba .swiper-button-prev',
      },
      breakpoints: {
        768: {
          slidesPerView: 2,
        }
      },
      a11y: {
        prevSlideMessage: '前のスライド',
        nextSlideMessage: '次のスライド',
      }
    });
  }
}

/* ============================================================
   HAMBURGER / SIDE DRAWER MENU
============================================================ */
function initHamburger() {
  const btn     = document.querySelector('.hamburger');
  const drawer  = document.getElementById('nav-drawer');
  const overlay = document.getElementById('nav-overlay');
  if (!btn || !drawer) return;

  function openDrawer() {
    drawer.classList.add('open');
    overlay?.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay?.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'メニューを閉じる');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    overlay?.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay?.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'メニューを開く');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', () => {
    btn.getAttribute('aria-expanded') === 'true' ? closeDrawer() : openDrawer();
  });

  overlay?.addEventListener('click', closeDrawer);
  document.getElementById('nav-drawer-close')?.addEventListener('click', closeDrawer);

  drawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeDrawer);
  });
}

/* ============================================================
   SMOOTH SCROLL (enhanced for anchor links)
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
      const top = target.getBoundingClientRect().top + window.scrollY - headerH - 8;

      window.scrollTo({ top, behavior: 'smooth' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });
}

/* ============================================================
   INTERSECTION OBSERVER (scroll animations)
============================================================ */
function initScrollAnimations() {
  if (!('IntersectionObserver' in window)) {
    // Fallback: show all immediately
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      el.classList.add('is-visible');
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

/* ============================================================
   INIT
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  renderReviews(reviews, 'reviews-grid');
  renderFAQ(faqs, 'faq-list');
  initHamburger();
  initSmoothScroll();
  initScrollAnimations();

  // Swiper init after a tick (allow DOM to settle)
  requestAnimationFrame(() => initSwipers());
});
