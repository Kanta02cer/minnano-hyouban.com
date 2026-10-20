/** Article outbound clicks only. No tags, cookies, storage, page_view or URL changes. */
export const DEFINITION = 'media-clicks-v2-draft1';
const SHARED = Symbol.for('jp.media.article-clicks.v2');
const TOKEN = /^[A-Za-z0-9_-]{1,64}$/;
const ID = /^[1-9][0-9]{0,11}$/;
const MEDIA = {
  minnano_hyouban: { host: 'minnano-hyouban.com', path: 'reports' },
  shacho_shuzai: { host: 'shacho-shuzai.com', path: 'articles' },
};
const KINDS = new Set(['official_site', 'official_service', 'news_gna']);
const safeToken = value => typeof value === 'string' && TOKEN.test(value);
const httpsURL = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
};

/** Only the numeric GNA id survives; duplicate ids and spoofed hosts fail closed. */
export function canonicalGnaArticle(href) {
  const u = httpsURL(href);
  if (!u || !['globalnewsasia.com', 'www.globalnewsasia.com'].includes(u.hostname) || u.pathname !== '/article.php') return null;
  const ids = u.searchParams.getAll('id');
  if (ids.length !== 1 || !ID.test(ids[0])) return null;
  return { news_media_id: 'globalnewsasia', news_article_id: ids[0], destination_host: 'globalnewsasia.com' };
}

function normalizeConfig(config, location) {
  const media = MEDIA[config?.mediaId];
  const current = httpsURL(location?.href);
  if (!media || !current || current.hostname !== media.host || !ID.test(config.articleId || '')) return null;
  const path = `/${media.path}/${config.articleId}/`;
  if (![path, `${path}index.html`].includes(current.pathname)) return null;
  if (!/^G-[A-Z0-9]{4,20}$/.test(config.measurementId || '') || !safeToken(config.manifestVersion)) return null;
  // Article-level collection can begin without a diagnostic company mapping.
  // Only an explicitly verified mapping can contribute company_id; no guessed IDs.
  if (!['verified', 'pending'].includes(config.companyMappingStatus)) return null;
  if (config.companyMappingStatus === 'verified' && !safeToken(config.companyId)) return null;
  if (config.companyMappingStatus === 'pending' && config.companyId != null) return null;
  if (!Array.isArray(config.links) || !config.links.length) return null;
  const links = new Map();
  for (const link of config.links) {
    if (!safeToken(link.id) || links.has(link.id) || !KINDS.has(link.kind) || link.verified !== true) return null;
    const dest = httpsURL(link.href);
    if (!dest || dest.hostname === media.host) return null;
    if (link.kind === 'news_gna' && !canonicalGnaArticle(link.href)) return null;
    if (link.kind !== 'news_gna' && ['minnano-hyouban.com', 'shacho-shuzai.com', 'globalnewsasia.com', 'www.globalnewsasia.com'].includes(dest.hostname)) return null;
    links.set(link.id, Object.freeze({ ...link, exactHref: dest.href }));
  }
  return { ...config, canonicalPage: `https://${media.host}${path}`, links };
}

/** Explicit event params prevent document query/referrer/anchor text entering our payload. */
export function eventForLink(config, link, actualHref) {
  const destination = httpsURL(actualHref);
  if (!destination || destination.href !== link.exactHref) return null;
  const params = {
    send_to: config.measurementId,
    media_id: config.mediaId,
    article_id: config.articleId,
    link_id: link.id,
    link_kind: link.kind,
    destination_host: destination.hostname,
    manifest_version: config.manifestVersion,
    measurement_definition: DEFINITION,
    page_location: config.canonicalPage,
    page_referrer: '',
    page_title: `${config.mediaId} ${config.articleId}`,
    transport_type: 'beacon',
  };
  if (config.companyMappingStatus === 'verified') params.company_id = config.companyId;
  if (link.kind === 'news_gna') {
    const news = canonicalGnaArticle(actualHref);
    if (!news) return null;
    Object.assign(params, news);
    return { name: 'article_news_click', params };
  }
  return { name: 'article_cta_click', params };
}

/**
 * Gates must read the real CMP and verified GA4 bootstrap state. Missing gates disable.
 * Second independent bundle shares one listener/state via Symbol.for on the same window.
 * No queued/replayed clicks: a refused event stays refused even after consent changes.
 */
export function installArticleClicks({ win = globalThis.window, doc = globalThis.document, config,
  consentGranted, ga4Ready, excluded = () => false } = {}) {
  const disabled = reason => Object.freeze({ installed: false, reason });
  if (!win || !doc || typeof doc.addEventListener !== 'function') return disabled('no_document');
  const normalized = normalizeConfig(config, win.location);
  if (!normalized) return disabled('invalid_or_unverified_config');
  if (typeof consentGranted !== 'function' || typeof ga4Ready !== 'function') return disabled('missing_consent_or_receiver_gate');
  const fingerprint = JSON.stringify({ ...normalized, links: [...normalized.links] });
  if (win[SHARED]) return win[SHARED].fingerprint === fingerprint
    ? win[SHARED].api : disabled('conflicting_second_config');
  const seen = new WeakSet();
  let sent = 0, unknown = 0;
  const handler = event => {
    if (!event || typeof event !== 'object' || seen.has(event)) return;
    // Mark before every gate: denied events cannot be replayed after consent changes.
    seen.add(event);
    if (event.isTrusted !== true || event.defaultPrevented) return;
    if (!((event.type === 'click' && event.button === 0) || (event.type === 'auxclick' && event.button === 1))) return;
    try {
      if (consentGranted() !== true || ga4Ready(normalized.measurementId) !== true || excluded() !== false || typeof win.gtag !== 'function') return;
      let target = event.target;
      if (target?.nodeType === 3) target = target.parentElement;
      const anchor = target?.closest?.('a[data-mm-link]');
      if (!anchor || !doc.contains(anchor) || anchor.hasAttribute('download')) return;
      const link = normalized.links.get(anchor.getAttribute('data-mm-link'));
      if (!link) return;
      const payload = eventForLink(normalized, link, anchor.href);
      if (!payload) return;
      // Never prevent navigation and never retry an uncertain gtag call.
      try {
        win.gtag('event', payload.name, payload.params);
        sent += 1;
      } catch { unknown += 1; }
    } catch { /* A gate/DOM error must not break the link or trigger a send. */ }
  };
  const api = Object.freeze({
    installed: true,
    // Means handed to gtag, NOT GA4 receipt. Only local counts; no user identity/storage.
    localStatus: () => ({ submittedToGtag: sent, unknownCalls: unknown }),
  });
  win[SHARED] = { fingerprint, api };
  doc.addEventListener('click', handler, false);
  doc.addEventListener('auxclick', handler, false);
  return api;
}
