/**
 * トップ・一覧・記者・法務ページ用 GA4 読み込み（記事個別は article-renderer.js 側）
 * <head> に <meta name="ga4-measurement-id" content="G-xxxxxxxxxx"> を置いたときだけ動作。
 */
(function () {
  'use strict';

  function consentOk() {
    try {
      const v = localStorage.getItem('analytics_consent');
      return v === null || v === 'true';
    } catch {
      return true;
    }
  }

  function validMeasurementId(id) {
    return typeof id === 'string' && /^G-[A-Z0-9]{6,}$/.test(id.trim());
  }

  function boot() {
    if (!consentOk()) return;
    const id =
      (typeof window.__GA4_MEASUREMENT_ID__ === 'string' && window.__GA4_MEASUREMENT_ID__.trim()) ||
      (document.querySelector('meta[name="ga4-measurement-id"]')?.content || '').trim();
    if (!validMeasurementId(id)) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        window.dataLayer.push(arguments);
      };

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);

    window.gtag('js', new Date());
    window.gtag('config', id);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
