/* Presentation only. Measurement is owned by media-analytics-entry.js. */
(() => {
  const motion = document.querySelector('[data-motion]');
  motion?.addEventListener('click', () => {
    const paused = document.body.classList.toggle('paused');
    motion.textContent = paused ? 'アニメーションを動かす' : 'アニメーションを止める';
    motion.setAttribute('aria-pressed', String(paused));
  });
  const cards = [...document.querySelectorAll('[data-story-card]')];
  const filters = [...document.querySelectorAll('[data-story-filter]')];
  const search = document.querySelector('[data-story-search]');
  let category = 'all';
  function update() {
    const query = (search?.value || '').normalize('NFKC').toLocaleLowerCase('ja');
    let count = 0;
    for (const card of cards) {
      const match = (category === 'all' || card.dataset.category === category) &&
        card.dataset.search.normalize('NFKC').toLocaleLowerCase('ja').includes(query);
      card.hidden = !match;
      if (match) count++;
    }
    const total = document.querySelector('[data-story-count]');
    if (total) total.textContent = String(count);
    const empty = document.querySelector('[data-story-empty]');
    if (empty) empty.hidden = count > 0;
  }
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.storyFilter;
    filters.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    update();
  }));
  search?.addEventListener('input', update);
})();
