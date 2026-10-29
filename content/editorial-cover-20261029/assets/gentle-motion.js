/* A paced cover entrance. Reading content stays visible without JavaScript. */
(() => {
  if (!document.body.classList.contains('variant-a')) return;
  const preferenceKey = 'sister-media-motion-paused';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  try { paused = sessionStorage.getItem(preferenceKey) === 'true'; } catch (_) {}
  const played = new WeakSet();
  const running = new Map();
  const hero = [...document.querySelectorAll('.editorial-main h1 > span, .editorial-intro > p, .editorial-note')];
  const rule = document.querySelector('.note-line');
  const cue = document.querySelector('.editorial-read > span');
  const stories = [...document.querySelectorAll('.editorial-stories .section-heading, .journal-story, .editorial-about')];
  const targets = [...hero, ...stories, rule, cue].filter(Boolean);
  targets.forEach(element => { element.dataset.motionState = 'ready'; });
  let observer;
  const stopped = () => paused || reduced.matches;
  const finish = element => {
    played.add(element);
    const animation = running.get(element);
    running.delete(element);
    if (animation) animation.cancel();
    element.dataset.motionState = 'done';
  };
  const inView = element => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  };
  function reveal(element, delay = 0, kind = 'content') {
    if (played.has(element)) return;
    if (stopped() || !element.animate || element.contains(document.activeElement)) {
      finish(element);
      return;
    }
    played.add(element);
    const isTitle = element.matches('.editorial-main h1 > span');
    const isStory = element.classList.contains('journal-story');
    const distance = isTitle ? 24 : isStory ? 22 : 14;
    const frames = kind === 'rule'
      ? [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }]
      : kind === 'cue'
        ? [{ transform: 'translateY(0)', offset: 0 }, { transform: 'translateY(6px)', offset: .35 }, { transform: 'translateY(0)', offset: .65 }, { transform: 'translateY(0)', offset: 1 }]
        : [{ opacity: .25, transform: `translateY(${distance}px)` }, { opacity: 1, transform: 'translateY(0)' }];
    const duration = kind === 'cue' ? 1600 : kind === 'rule' ? 1200 : isTitle ? 1100 : 950;
    const animation = element.animate(frames, {
      duration,
      delay,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      iterations: kind === 'cue' ? 3 : 1,
      fill: 'backwards'
    });
    running.set(element, animation);
    element.dataset.motionState = 'running';
    element.dataset.motionRuns = '1';
    element.dataset.motionDuration = String(duration);
    element.dataset.motionKind = kind;
    const complete = () => {
      running.delete(element);
      element.dataset.motionState = 'done';
    };
    animation.onfinish = complete;
    animation.oncancel = complete;
  }
  function syncPreference() {
    document.body.classList.toggle('motion-stopped', stopped());
    document.querySelectorAll('.motion-toggle').forEach(button => {
      button.setAttribute('aria-pressed', String(stopped()));
      button.textContent = stopped() ? '動きを再開する' : '動きを止める';
      button.disabled = reduced.matches;
      if (reduced.matches) button.title = '端末の設定に合わせて動きを停止しています';
      else button.removeAttribute('title');
    });
    if (stopped()) {
      [...running.keys()].forEach(finish);
      targets.filter(inView).forEach(element => {
        finish(element);
        if (observer) observer.unobserve(element);
      });
    }
  }
  syncPreference();
  document.addEventListener('editorial-motion-change', event => {
    paused = event.detail.paused;
    try { sessionStorage.setItem(preferenceKey, String(paused)); } catch (_) {}
    syncPreference();
  });
  if (reduced.addEventListener) reduced.addEventListener('change', syncPreference);
  else reduced.addListener(syncPreference);
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      let stagger = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        reveal(entry.target, stagger);
        stagger += 140;
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -20px 0px' });
    stories.forEach(element => observer.observe(element));
    const coverObserver = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting && cue && running.has(cue)) finish(cue);
    });
    coverObserver.observe(document.querySelector('.editorial-cover'));
  } else stories.forEach(finish);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (window.location.hash || window.scrollY > 24) [...hero, rule, cue].filter(Boolean).forEach(finish);
    else {
      hero.forEach((element, index) => reveal(element, index * 220));
      if (rule) reveal(rule, 900, 'rule');
      if (cue) reveal(cue, 1400, 'cue');
    }
  }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) [...running.keys()].forEach(finish);
  });
  document.addEventListener('focusin', event => {
    const story = event.target.closest('.journal-story');
    if (story) finish(story);
  });
})();
