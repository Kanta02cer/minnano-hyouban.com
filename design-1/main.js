/* Design 1 — main.js — Verified Review */
'use strict';

const reviews = [
  { id:1, name:"田中 M様", age:"32歳・女性", stars:5, tag:"効果実感", text:"最初は半信半疑でしたが、使ってみて本当によかったです。他の口コミサイトと違い、具体的な体験談が多くて参考になりました。" },
  { id:2, name:"佐藤 K様", age:"45歳・男性", stars:5, tag:"信頼性",  text:"企業の広告では分からないリアルな情報が載っていて、購入前の不安が解消されました。友人にも勧めています。" },
  { id:3, name:"伊藤 A様", age:"28歳・女性", stars:4, tag:"価格納得", text:"料金が少し高いかと思いましたが、サービスの質を考えると納得できました。担当の方の対応も丁寧でした。" },
  { id:4, name:"山本 T様", age:"38歳・男性", stars:4, tag:"使いやすさ",text:"初めて利用しましたが、思っていたより使いやすかったです。もう少し早く知りたかった。" },
  { id:5, name:"鈴木 E様", age:"41歳・女性", stars:5, tag:"継続利用", text:"友人に勧められて使ってみました。期待以上の結果が出て、今では毎月利用しています。継続するつもりです。" }
];

const faqs = [
  { q:"本当に効果はありますか？", a:"実際にご利用いただいた方の〇割以上が「満足」とお答えいただいています。個人差はありますが、多くの方に実感していただいています。" },
  { q:"料金はどのくらいかかりますか？", a:"サービス内容によって異なります。詳細は公式サイトのお問い合わせフォームよりご確認ください。" },
  { q:"初めてでも安心して使えますか？", a:"はい、初めての方でも丁寧にサポートいたします。ご不明な点はお気軽にご相談ください。" },
  { q:"解約・キャンセルはできますか？", a:"所定の手続きにより解約が可能です。詳細は公式サイトをご確認ください。" },
  { q:"この記事は広告ですか？", a:"本記事はPR記事です。第三者の記者が取材・編集していますが、掲載費用を企業からいただいています。" }
];

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function stars(n,m=5){ let h=''; for(let i=1;i<=m;i++) h+=i<=n?'★':'☆'; return h; }

function renderReviews(){
  const g = document.getElementById('reviews-grid');
  if(!g) return;
  reviews.forEach(r=>{
    const d = document.createElement('article');
    d.className = 'review-card';
    d.setAttribute('role','listitem');
    d.innerHTML = `
      <div class="review-header">
        <div class="review-avatar" aria-hidden="true">${esc(r.name.charAt(0))}</div>
        <div class="review-meta">
          <p class="review-name">${esc(r.name)}</p>
          <p class="review-age">${esc(r.age)}</p>
        </div>
        <span class="review-tag">${esc(r.tag)}</span>
      </div>
      <p class="review-stars" aria-label="評価${r.stars}点">${stars(r.stars)}</p>
      <p class="review-text">${esc(r.text)}</p>`;
    g.appendChild(d);
  });
}

function renderFAQ(){
  const dl = document.getElementById('faq-list');
  if(!dl) return;
  faqs.forEach((f,i)=>{
    const id = `fa-${i}`;
    const div = document.createElement('div');
    div.className = 'faq-item';
    const dt = document.createElement('dt');
    dt.innerHTML = `<button class="faq-question" aria-expanded="false" aria-controls="${id}">
      <span class="faq-q-label" aria-hidden="true">Q</span>
      <span class="faq-q-text">${esc(f.q)}</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>`;
    const dd = document.createElement('dd');
    dd.id = id; dd.className = 'faq-answer-wrap';
    dd.innerHTML = `<div class="faq-answer"><span class="faq-a-label">A.</span>${esc(f.a)}</div>`;
    div.append(dt, dd);
    dl.appendChild(div);
    dt.querySelector('button').addEventListener('click', e=>{
      const open = e.currentTarget.getAttribute('aria-expanded')==='true';
      e.currentTarget.setAttribute('aria-expanded', String(!open));
      dd.style.maxHeight = open ? '0' : dd.scrollHeight+'px';
    });
  });
}

function initScoreBars(){
  const rows = document.querySelectorAll('.score-bar-row[data-score]');
  if(!rows.length) return;

  if(!('IntersectionObserver' in window)){
    rows.forEach(row=>{
      row.style.setProperty('--bar-pct', row.dataset.score + '%');
      row.classList.add('bar-animated');
    });
    return;
  }

  const ob = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      const row = e.target;
      const idx = Array.from(rows).indexOf(row);
      row.style.setProperty('--bar-pct', row.dataset.score + '%');
      setTimeout(()=> row.classList.add('bar-animated'), idx * 120);
      ob.unobserve(row);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -30px 0px' });

  rows.forEach(row => ob.observe(row));
}

function initSwipers(){
  if(document.querySelector('.swiper-service')){
    new Swiper('.swiper-service',{
      loop:true, slidesPerView:1.2, spaceBetween:16, centeredSlides:true,
      pagination:{el:'.swiper-service .swiper-pagination',clickable:true},
      breakpoints:{768:{slidesPerView:2.5,centeredSlides:false,spaceBetween:20}}
    });
  }
  if(document.querySelector('.swiper-ba')){
    new Swiper('.swiper-ba',{
      slidesPerView:1, spaceBetween:20,
      navigation:{nextEl:'.swiper-ba .swiper-button-next',prevEl:'.swiper-ba .swiper-button-prev'},
      breakpoints:{768:{slidesPerView:2}}
    });
  }
}

function initHamburger(){
  const btn = document.querySelector('.hamburger');
  const nav = document.getElementById('nav-mobile');
  if(!btn||!nav) return;
  btn.addEventListener('click',()=>{
    const open = btn.getAttribute('aria-expanded')==='true';
    btn.setAttribute('aria-expanded',String(!open));
    nav.hidden = open;
  });
  document.addEventListener('click',e=>{
    if(!btn.contains(e.target)&&!nav.contains(e.target)){
      btn.setAttribute('aria-expanded','false');
      nav.hidden=true;
    }
  });
}

function initScroll(){
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const t = document.getElementById(a.getAttribute('href').slice(1));
      if(!t) return;
      e.preventDefault();
      const h = document.querySelector('.site-header')?.offsetHeight||62;
      window.scrollTo({top:t.getBoundingClientRect().top+scrollY-h-8,behavior:'smooth'});
    });
  });
}

function initAnim(){
  if(!('IntersectionObserver' in window)){
    document.querySelectorAll('.anim-up').forEach(el=>el.classList.add('visible'));
    return;
  }
  const ob = new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visible'); ob.unobserve(e.target); } });
  },{threshold:.1,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.anim-up').forEach(el=>ob.observe(el));
}

document.addEventListener('DOMContentLoaded',()=>{
  renderReviews();
  renderFAQ();
  initScoreBars();
  initHamburger();
  initScroll();
  initAnim();
  requestAnimationFrame(initSwipers);
});
