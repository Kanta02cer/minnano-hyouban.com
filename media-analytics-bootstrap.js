import { installArticleClicks } from './media-clicks.js';

export const CONSENT_KEY = 'media_analytics_choice_v1';
const SINGLETON = Symbol.for('jp.media.analytics-bootstrap.v1');
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
const MEDIA = { minnano_hyouban: ['minnano-hyouban.com', 'reports'], shacho_shuzai: ['shacho-shuzai.com', 'articles'] };
const DENIED = Object.freeze({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
const GRANTED = Object.freeze({ ...DENIED, analytics_storage: 'granted' });

export function savedChoice(storage, version, now = Date.now()) {
  try {
    const item = JSON.parse(storage?.getItem(CONSENT_KEY) || 'null');
    return item && item.version === version && ['granted', 'denied'].includes(item.choice)
      && Number.isFinite(item.at) && item.at <= now && now - item.at <= MAX_AGE ? item.choice : 'unknown';
  } catch { return 'unknown'; }
}

export function validActivation(config, href) {
  try {
    const source = MEDIA[config?.mediaId], u = new URL(href);
    if (!source || u.protocol !== 'https:' || u.hostname !== source[0] || u.port || u.username || u.password) return false;
    if (!/^[1-9][0-9]{0,11}$/.test(config.articleId || '')) return false;
    if (![`/${source[1]}/${config.articleId}/`, `/${source[1]}/${config.articleId}/index.html`].includes(u.pathname)) return false;
    if (config.enabled !== true || !/^G-[A-Z0-9]{4,20}$/.test(config.measurementId || '')) return false;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(config.consentVersion || '')) return false;
    if (!config.verification || ['streamConfirmed','enhancedMeasurementDisabled','privacyUpdated'].some(k => config.verification[k] !== true)) return false;
    const privacy = new URL(config.privacyUrl, u.origin);
    if (privacy.origin !== u.origin || privacy.search || !config.privacyUrl?.startsWith('/') || config.privacyUrl.startsWith('//')) return false;
    return true;
  } catch { return false; }
}

/** Pure state machine. platform is supplied by the production DOM adapter or local tests. */
export function createConsentController({config, platform, storage, now = () => Date.now()}) {
  let choice = savedChoice(storage, config.consentVersion, now());
  let state = 'idle', loading = null, configured = false, pageViewAttempted = false;
  let storageAvailable = true;
  // A read-only/blocked store must not revive an older grant on this page.
  if (choice !== 'unknown') {
    try {
      const retained = storage.getItem(CONSENT_KEY);
      storage.setItem(CONSENT_KEY, retained);
      if (storage.getItem(CONSENT_KEY) !== retained) throw new Error('storage_write_not_retained');
    } catch { choice = 'unknown'; storageAvailable = false; }
  }
  const listeners = new Set();
  const snapshot = () => ({choice, state, pageViewAttempted, storageAvailable});
  const notify = () => listeners.forEach(fn => fn(snapshot()));
  platform.block();
  const enable = async () => {
    if (choice !== 'granted' || state === 'error' || state === 'ready') return;
    if (!loading) {
      state = 'loading'; notify();
      try { loading = Promise.resolve(platform.load()); } catch { state = 'error'; notify(); return; }
    }
    try {
      await loading;
      if (choice !== 'granted') { platform.block(); state = 'paused'; notify(); return; }
      // Concurrent grants may await the same load; configure/page_view still run once.
      if (!configured) { platform.configure(); configured = true; }
      platform.enable(); state = 'ready';
      if (!pageViewAttempted) { pageViewAttempted = true; platform.pageView(); }
      notify();
    } catch { platform.block(); state = 'error'; notify(); }
  };
  const setChoice = next => {
    if (!['granted','denied'].includes(next)) return false;
    choice = next;
    try { storage.setItem(CONSENT_KEY, JSON.stringify({version:config.consentVersion, choice, at:now()})); }
    catch {
      storageAvailable = false;
      // Remove any older grant if updating its choice failed.
      try { storage.removeItem(CONSENT_KEY); } catch {}
    }
    if (choice === 'denied') {
      // Disable before consent update or cookie removal. No late callback can re-enable.
      platform.block(); platform.revoke(); state = state === 'error' ? 'error' : 'paused'; notify();
    } else { notify(); void enable(); }
    return true;
  };
  return Object.freeze({
    getState: snapshot, choose: setChoice,
    start: () => choice === 'granted' ? enable() : Promise.resolve(),
    allowed: () => choice === 'granted' && state === 'ready',
    subscribe: fn => { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); },
    // Other tabs can revoke. A grant from another tab never enables this document silently.
    onStorage: event => { if ((event.key === CONSENT_KEY || event.key === null) && savedChoice(storage, config.consentVersion, now()) !== 'granted') {
      choice = 'denied'; platform.block(); platform.revoke(); state = state === 'error' ? 'error' : 'paused'; notify();
    } },
  });
}

function removeOwnGaCookies(win, doc, measurementId) {
  const host = win.location.hostname;
  for (const name of ['_ga', `_ga_${measurementId.slice(2)}`]) {
    for (const domain of ['', `; Domain=${host}`, `; Domain=.${host}`]) {
      doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain}`;
    }
  }
}

export function createProductionPlatform(win, doc, config) {
  const disabledKey = `ga-disable-${config.measurementId}`;
  let ownTagInitialized = false, script;
  const source = MEDIA[config.mediaId];
  const safePage = {
    page_location: `https://${source[0]}/${source[1]}/${config.articleId}/`,
    page_referrer: '', page_title: `${config.mediaId} ${config.articleId}`,
  };
  const initializeQueue = () => {
    if (ownTagInitialized) return;
    win.dataLayer = [];
    win.gtag = function () { win.dataLayer.push(arguments); };
    win.gtag('consent', 'default', {...DENIED});
    ownTagInitialized = true;
  };
  return {
    block: () => { win[disabledKey] = true; },
    load: () => {
      initializeQueue();
      return new Promise((resolve, reject) => {
        script = doc.createElement('script'); script.async = true; script.referrerPolicy = 'no-referrer';
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.measurementId)}`;
        script.dataset.mediaAnalyticsOwned = 'true';
        const timeout = win.setTimeout(() => reject(new Error('tag_load_timeout')), 20000);
        script.onload = () => { win.clearTimeout(timeout); resolve(); };
        script.onerror = () => { win.clearTimeout(timeout); reject(new Error('tag_load_failed')); };
        doc.head.append(script);
      });
    },
    configure: () => {
      // These queue/config calls are permitted only after explicit grant and library load.
      win.gtag('js', new Date());
      win.gtag('set', {...safePage, allow_google_signals:false, allow_ad_personalization_signals:false});
      win.gtag('config', config.measurementId, {
        ...safePage, send_page_view:false, allow_google_signals:false,
        allow_ad_personalization_signals:false, cookie_domain:source[0], cookie_path:'/',
        cookie_flags:'SameSite=Lax;Secure', cookie_expires:60*60*24*180,
      });
    },
    enable: () => { win[`ga-disable-${config.measurementId}`] = false; win.gtag('consent','update',{...GRANTED}); },
    revoke: () => {
      if (ownTagInitialized) win.gtag('consent','update',{...DENIED});
      removeOwnGaCookies(win,doc,config.measurementId);
    },
    pageView: () => win.gtag('event','page_view', {
      ...safePage, send_to:config.measurementId, media_id:config.mediaId, article_id:config.articleId,
      ...(config.companyMappingStatus === 'verified' ? {company_id:config.companyId} : {}),
      measurement_definition:'media-clicks-v2-draft1',
    }),
  };
}

export function mountConsentUI({doc,controller,privacyUrl}) {
  const root = doc.createElement('section'); root.className='mm-consent'; root.setAttribute('aria-label','アクセス解析の設定');
  root.innerHTML = `<div class="mm-consent-panel" hidden><h2 class="mm-consent-title">アクセス解析について</h2><p class="mm-consent-copy">記事の閲覧数や、企業・ニュースへのリンクのクリック数を集計するため、Google アナリティクスを利用します。許可しなくても、すべての記事をご覧いただけます。</p><p class="mm-consent-links"><a class="mm-consent-privacy">詳しい取り扱い</a><span>設定はいつでも変更できます。</span></p><div class="mm-consent-actions"><button type="button" data-choice="granted">解析を許可する</button><button type="button" data-choice="denied">許可しない</button></div><p class="mm-consent-status" aria-live="polite"></p><button type="button" class="mm-consent-close">閉じる</button></div><button type="button" class="mm-consent-open" aria-expanded="false">解析の設定</button>`;
  const panel=root.querySelector('.mm-consent-panel'), reopen=root.querySelector('.mm-consent-open');
  const close=root.querySelector('.mm-consent-close'), status=root.querySelector('.mm-consent-status');
  root.querySelector('.mm-consent-privacy').setAttribute('href',privacyUrl);
  const show = (open, focus=false) => {
    panel.hidden=!open; reopen.setAttribute('aria-expanded',String(open));
    if (focus) (open ? root.querySelector('[data-choice="granted"]') : reopen).focus();
  };
  reopen.addEventListener('click',()=>show(panel.hidden,true));
  close.addEventListener('click',()=>show(false,true));
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){show(false,true);}});
  for(const button of root.querySelectorAll('[data-choice]')) button.addEventListener('click',()=>{
    controller.choose(button.dataset.choice); show(false,true);
  });
  controller.subscribe(s=>{
    status.textContent = s.choice==='granted' ? '現在の設定：解析を許可' : s.choice==='denied' ? '現在の設定：解析を許可しない' : '現在の設定：未選択（解析は停止中）';
    if (!s.storageAvailable) status.textContent += '。このブラウザーでは設定を保存できないため、次のページで再度選択してください。';
    if(s.state==='error') status.textContent+='。現在、解析は停止しています。';
  });
  show(controller.getState().choice==='unknown');
  doc.body.append(root);
  return Object.freeze({open:()=>show(true,true),element:root});
}

export function startProductionAnalytics({win=globalThis.window,doc=globalThis.document,config}={}) {
  const disabled=reason=>Object.freeze({installed:false,reason});
  if(!win||!doc||!validActivation(config,win.location?.href)) return disabled('activation_not_verified');
  const fingerprint=JSON.stringify(config);
  if(win[SINGLETON]) return win[SINGLETON].fingerprint===fingerprint?win[SINGLETON].api:disabled('conflicting_activation');
  if(win.gtag || win.dataLayer || doc.querySelector('script[src*="googletagmanager.com"],script[src*="google-analytics.com"]')) return disabled('existing_tag_requires_reconciliation');
  let storage;try{storage=win.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('storage_unavailable');}};}
  const controller=createConsentController({config,storage,platform:createProductionPlatform(win,doc,config)});
  const clicks=installArticleClicks({win,doc,config,consentGranted:controller.allowed,ga4Ready:id=>id===config.measurementId&&controller.allowed()});
  if(!clicks.installed) return disabled(clicks.reason);
  const ui=mountConsentUI({doc,controller,privacyUrl:config.privacyUrl});
  const api=Object.freeze({installed:true,controller,ui,clicks});
  win[SINGLETON]={fingerprint,api};
  win.addEventListener('storage',controller.onStorage);
  void controller.start();
  return api;
}
