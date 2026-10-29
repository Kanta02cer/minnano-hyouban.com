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

/** Privacy-page controls only. This module never inserts an overlay into an article. */
export function startPrivacySettings({win=globalThis.window,doc=globalThis.document,config}={}) {
  const expected = {
    minnano_hyouban: ['minnano-hyouban.com', '/privacy.html', 'G-YBRSKWW8VE'],
    shacho_shuzai: ['shacho-shuzai.com', '/about/', 'G-TWTSBFXEL1'],
  }[config?.mediaId];
  let url;
  try { url = new URL(win.location.href); } catch { return false; }
  if (!expected || url.protocol !== 'https:' || url.hostname !== expected[0] || url.port
    || url.username || url.password || !(expected[1].endsWith('/') ? [expected[1], expected[1] + 'index.html'] : [expected[1]]).includes(url.pathname)
    || config.measurementId !== expected[2] || !/^[A-Za-z0-9_-]{1,64}$/.test(config.consentVersion || '')) return false;
  const root = doc.getElementById('media-privacy-settings');
  if (!root || root.dataset.initialized === 'true') return false;
  const status = root.querySelector('[role="status"]');
  const buttons = [...root.querySelectorAll('button[data-choice]')];
  if (!status || buttons.length !== 2) return false;
  let storage;
  try { storage = win.localStorage; } catch {}
  const render = (message='') => {
    const choice = savedChoice(storage,config.consentVersion);
    status.textContent = message || (choice === 'granted' ? '現在の設定：許可しています。次に記事を開いたときから適用されます。'
      : choice === 'denied' ? '現在の設定：許可していません。' : '現在の設定：未選択です。アクセス解析は停止しています。');
    for (const button of buttons) button.setAttribute('aria-pressed',String(button.dataset.choice === choice));
  };
  for (const button of buttons) button.addEventListener('click',()=>{
    const choice=button.dataset.choice;
    if (!['granted','denied'].includes(choice)) return;
    if (choice === 'denied') {
      win[`ga-disable-${config.measurementId}`] = true;
      removeOwnGaCookies(win,doc,config.measurementId);
    }
    try {
      if (!storage) throw Error('storage_unavailable');
      storage.setItem(CONSENT_KEY,JSON.stringify({version:config.consentVersion,choice,at:Date.now()}));
      if (savedChoice(storage,config.consentVersion) !== choice) throw Error('storage_write_not_retained');
      render();
    } catch {
      try { storage?.removeItem(CONSENT_KEY); } catch {}
      render('設定を保存できませんでした。ブラウザーの保存設定をご確認ください。');
    }
  });
  win.addEventListener('storage',event=>{if(event.key === CONSENT_KEY || event.key === null) render();});
  root.dataset.initialized='true';
  for (const button of buttons) button.disabled=false;
  render();
  return true;
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
  // Articles remain unobstructed; preferences are changed on the privacy page.
  const ui=null;
  const api=Object.freeze({installed:true,controller,ui,clicks});
  win[SINGLETON]={fingerprint,api};
  win.addEventListener('storage',controller.onStorage);
  void controller.start();
  return api;
}
