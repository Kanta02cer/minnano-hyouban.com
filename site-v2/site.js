'use strict';

// Retire the former site's service worker and its own cache on the first visit
// after the redesign. This does not collect or transmit browsing information.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration('/').then(registration => {
    if (registration?.active?.scriptURL === new URL('/sw.js', location.href).href) {
      return registration.unregister();
    }
  }).catch(() => {});
}
if ('caches' in window) {
  caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith('mhcom-')).map(name => caches.delete(name))
  )).catch(() => {});
}

// The archive remains complete HTML without JavaScript. Search only changes
// what is shown in the browser; crawlers and keyboard users can reach every link.
const reportSearch = document.querySelector('#report-search');
if (reportSearch) {
  const groups = [...document.querySelectorAll('[data-report-group]')];
  const count = document.querySelector('#search-result-count');
  const empty = document.querySelector('#search-no-results');
  reportSearch.addEventListener('input', () => {
    const term = reportSearch.value.normalize('NFKC').trim().toLocaleLowerCase('ja');
    let visible = 0;
    for (const group of groups) {
      let groupVisible = 0;
      for (const card of group.querySelectorAll('[data-report-card]')) {
        const source = (card.dataset.search || '').normalize('NFKC').toLocaleLowerCase('ja');
        card.hidden = !source.includes(term);
        if (!card.hidden) groupVisible++;
      }
      group.hidden = groupVisible === 0;
      visible += groupVisible;
    }
    if (count) count.textContent = `${visible}記事を表示`;
    if (empty) empty.hidden = visible !== 0;
  });
}

// Animate only elements below the first viewport. Without JavaScript or
// IntersectionObserver, every section stays visible in its normal position.
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const reveal = element => {
    element.classList.remove('motion-pending');
    element.classList.add('motion-visible');
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        reveal(entry.target);
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -35px 0px', threshold: 0.08 });

  document.querySelectorAll('.section-head, .report-card, .topic-card, .principles-list li, .card-grid .card')
    .forEach((element, index) => {
      if (element.getBoundingClientRect().top <= window.innerHeight - 28) return;
      element.style.setProperty('--motion-delay', `${index % 2 * 65}ms`);
      element.classList.add('motion-pending');
      observer.observe(element);
    });
}
