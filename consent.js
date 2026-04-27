/**
 * ================================================================
 *  みんなの評判.com — Consent Mode v2 バナー
 *
 *  Google Consent Mode v2 に準拠した同意バナー。
 *  - analytics_storage: デフォルト granted（計測継続）
 *  - ad_storage / ad_user_data / ad_personalization: デフォルト denied
 *  ユーザーが「全て同意」を押した場合のみ広告系も granted に更新する。
 * ================================================================
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'mhcom_consent_v1';
  var GA4_ID      = 'G-0XHQPCC4CF';

  // ── localStorage から過去の同意を読み込み ──────────────────────
  function loadConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(obj) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  // ── gtag consent update ─────────────────────────────────────────
  function applyConsent(obj) {
    if (typeof gtag === 'function') {
      gtag('consent', 'update', obj);
    }
  }

  // ── 過去の同意が存在する場合は即時適用してバナーをスキップ ─────
  var stored = loadConsent();
  if (stored) {
    applyConsent(stored);
    return; // バナー表示不要
  }

  // ── バナー HTML を生成・挿入 ─────────────────────────────────────
  function createBanner() {
    var banner = document.createElement('div');
    banner.id = 'consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie・プライバシー設定');
    banner.innerHTML =
      '<div class="cb-inner">' +
        '<div class="cb-text">' +
          '<p class="cb-title">Cookie・プライバシーについて</p>' +
          '<p class="cb-body">当サイトでは Google Analytics（アクセス解析）を使用しています。' +
            '「全て同意」を選択すると、広告のパーソナライズやコンバージョン計測にも Cookie を使用します。' +
            '詳細は<a href="/privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>をご確認ください。</p>' +
        '</div>' +
        '<div class="cb-buttons">' +
          '<button id="consent-deny"  class="cb-btn cb-btn-secondary">必須のみ許可</button>' +
          '<button id="consent-accept" class="cb-btn cb-btn-primary">全て同意</button>' +
        '</div>' +
      '</div>';

    // スタイル
    var style = document.createElement('style');
    style.textContent =
      '#consent-banner{' +
        'position:fixed;bottom:0;left:0;right:0;z-index:99999;' +
        'background:#fff;border-top:2px solid #b8974a;' +
        'box-shadow:0 -4px 24px rgba(0,0,0,.12);' +
        'padding:16px 20px;font-family:"Noto Sans JP",sans-serif;font-size:13px;' +
      '}' +
      '#consent-banner .cb-inner{' +
        'max-width:900px;margin:0 auto;' +
        'display:flex;flex-wrap:wrap;align-items:center;gap:12px;' +
      '}' +
      '#consent-banner .cb-text{flex:1 1 300px;}' +
      '#consent-banner .cb-title{font-weight:700;font-size:14px;margin:0 0 4px;color:#0d1b3e;}' +
      '#consent-banner .cb-body{margin:0;line-height:1.6;color:#444;}' +
      '#consent-banner .cb-body a{color:#b8974a;text-decoration:underline;}' +
      '#consent-banner .cb-buttons{display:flex;gap:8px;flex-shrink:0;}' +
      '#consent-banner .cb-btn{' +
        'padding:10px 18px;border-radius:6px;border:none;cursor:pointer;' +
        'font-size:13px;font-weight:600;line-height:1;white-space:nowrap;' +
      '}' +
      '#consent-banner .cb-btn-primary{background:#0d1b3e;color:#fff;}' +
      '#consent-banner .cb-btn-primary:hover{background:#1a3060;}' +
      '#consent-banner .cb-btn-secondary{background:#f0f0f0;color:#333;}' +
      '#consent-banner .cb-btn-secondary:hover{background:#e0e0e0;}' +
      '@media(max-width:600px){' +
        '#consent-banner .cb-inner{flex-direction:column;}' +
        '#consent-banner .cb-buttons{width:100%;justify-content:flex-end;}' +
      '}';

    document.head.appendChild(style);
    document.body.appendChild(banner);
    return banner;
  }

  function removeBanner(banner) {
    if (banner && banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  }

  // ── DOM 準備完了後にバナーを表示 ───────────────────────────────
  function init() {
    var banner = createBanner();

    document.getElementById('consent-accept').addEventListener('click', function () {
      var consent = {
        ad_storage:         'granted',
        ad_user_data:       'granted',
        ad_personalization: 'granted',
        analytics_storage:  'granted'
      };
      saveConsent(consent);
      applyConsent(consent);
      removeBanner(banner);
    });

    document.getElementById('consent-deny').addEventListener('click', function () {
      var consent = {
        ad_storage:         'denied',
        ad_user_data:       'denied',
        ad_personalization: 'denied',
        analytics_storage:  'granted'
      };
      saveConsent(consent);
      applyConsent(consent);
      removeBanner(banner);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
