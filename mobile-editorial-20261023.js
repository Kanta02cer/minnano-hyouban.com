/* Local presentation controls only. No social SDK, automatic posting or analytics. */
(() => {
  const menu = document.querySelector('.menu-toggle');
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    document.querySelector('#site-menu').classList.toggle('open', open);
  });
  document.querySelectorAll('.mobile-toc a').forEach(a => a.addEventListener('click', () => { a.closest('details').open = false; }));
  const search = document.querySelector('#editorial-search');
  const cards = [...document.querySelectorAll('[data-editorial-card]')];
  search?.addEventListener('input', () => {
    const query = search.value.normalize('NFKC').trim().toLocaleLowerCase('ja');
    let count = 0;
    cards.forEach(card => {
      card.hidden = !card.dataset.search.normalize('NFKC').toLocaleLowerCase('ja').includes(query);
      if (!card.hidden) count++;
    });
    document.querySelector('.search-count').textContent = `${count}件の記事`;
    document.querySelector('.search-empty').hidden = count > 0;
  });
  document.querySelectorAll('[data-copy-url]').forEach(button => button.addEventListener('click', async () => {
    const status = button.parentElement.querySelector('.copy-status');
    try {
      await navigator.clipboard.writeText(button.dataset.copyUrl);
      status.textContent = 'URLをコピーしました';
    } catch (_) {
      status.textContent = 'コピーできませんでした。アドレス欄のURLをご利用ください。';
    }
  }));
})();
