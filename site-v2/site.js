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
