/**
 * ================================================================
 *  みんなの評判.com — Netlify Edge Function: AI Bot Router v2
 *
 *  URLごとに独立したペルソナ（コンセプト）をAIクローラに返す。
 *  配信優先順:
 *    1. concept_file  — ペルソナ特化型指示書（最優先）
 *    2. llms_file     — 汎用 per-article llms.txt
 *    3. llms.txt      — グローバルフォールバック
 *    4. context.next() — 人間アクセス・その他（パススルー）
 *
 *  ルートマップ: /aio-route-map.json（5分間キャッシュ）
 * ================================================================
 */

/** AIクローラ User-Agent 判定リスト */
const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'PerplexityBot',
  'Claude-Web',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'cohere-ai',
  'YouBot',
  'meta-externalagent',
  'Bytespider',
  'DeepSeek',
  'Grok',
  'CCBot',
  'Diffbot',
  'Amazonbot',
  'AI2Bot',
];

// ── モジュールレベルキャッシュ（Warm 起動間で保持）──────────────────
let _routeMapCache    = null;
let _routeMapCachedAt = 0;
const CACHE_TTL_MS    = 5 * 60 * 1000; // 5分

/**
 * aio-route-map.json を取得（5分キャッシュ）
 * @param {string} origin
 * @returns {Promise<object|null>}
 */
async function getRouteMap(origin) {
  const now = Date.now();
  if (_routeMapCache && (now - _routeMapCachedAt) < CACHE_TTL_MS) {
    return _routeMapCache;
  }
  try {
    const res = await fetch(`${origin}/aio-route-map.json`);
    if (res.ok) {
      _routeMapCache    = await res.json();
      _routeMapCachedAt = now;
    }
  } catch { /* キャッシュ済みを継続使用 */ }
  return _routeMapCache;
}

/**
 * 静的ファイルをフェッチしてレスポンス生成（失敗時 null）
 * @param {string} url
 * @param {Record<string, string>} headers
 * @returns {Promise<Response|null>}
 */
async function fetchStatic(url, headers) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Response(await res.text(), { status: 200, headers });
  } catch {
    return null;
  }
}

/**
 * slug が安全な数値ID形式かを検証（パストラバーサル防止）
 * @param {string|null} slug
 * @returns {boolean}
 */
function isValidSlug(slug) {
  return typeof slug === 'string' && /^\d{10,20}$/.test(slug);
}

export default async function handler(request, context) {
  const userAgent = request.headers.get('user-agent') || '';
  const url       = new URL(request.url);

  // ── AI Bot 判定 ─────────────────────────────────────────────
  const isAiBot = AI_BOTS.some(bot => userAgent.includes(bot));
  if (!isAiBot) return context.next();

  const { pathname, origin, searchParams } = url;

  // ── /article.html?id=SLUG → コンセプト → llms → グローバル ─
  if (pathname === '/article.html') {
    const slug = searchParams.get('id');

    if (isValidSlug(slug)) {
      // route-map でこの slug のルーティングを検索
      const routeMap = await getRouteMap(origin);
      const route    = routeMap?.routes?.[slug];

      // 1. コンセプトファイル（最優先：ペルソナ特化指示書）
      const conceptPath = route?.concept_file || `/llms/articles/${slug}-concept.txt`;
      const conceptRes  = await fetchStatic(`${origin}${conceptPath}`, {
        'Content-Type':  'text/plain; charset=utf-8',
        'X-AIO-Served':  `concept-${slug}`,
        'X-AIO-Concept': route?.concept || '',
        'X-AIO-Intent':  route?.intent  || '',
        'X-Robots-Tag':  'noindex',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      });
      if (conceptRes) return conceptRes;

      // 2. llms.txt フォールバック（汎用 per-article）
      const llmsPath = route?.llms_file || `/llms/articles/${slug}.txt`;
      const llmsRes  = await fetchStatic(`${origin}${llmsPath}`, {
        'Content-Type':  'text/plain; charset=utf-8',
        'X-AIO-Served':  `article-llms-${slug}`,
        'X-Robots-Tag':  'noindex',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      });
      if (llmsRes) return llmsRes;
    }

    // 3. グローバル llms.txt フォールバック
    const globalRes = await fetchStatic(`${origin}/llms.txt`, {
      'Content-Type':  'text/plain; charset=utf-8',
      'X-AIO-Served':  'global-llms-fallback',
      'Cache-Control': 'public, max-age=3600',
    });
    if (globalRes) return globalRes;
  }

  // ── /ai-instruction.json?id=SLUG ────────────────────────────
  if (pathname === '/ai-instruction.json') {
    const slug = searchParams.get('id');

    if (isValidSlug(slug)) {
      const routeMap = await getRouteMap(origin);
      const route    = routeMap?.routes?.[slug];
      const jsonPath = route?.ai_instruction_file || `/llms/articles/${slug}-ai-instruction.json`;

      const jsonRes = await fetchStatic(`${origin}${jsonPath}`, {
        'Content-Type':  'application/json; charset=utf-8',
        'X-AIO-Served':  `ai-instruction-${slug}`,
        'Cache-Control': 'public, max-age=3600',
      });
      if (jsonRes) return jsonRes;
    }

    // ID なし → グローバル静的ファイルをそのまま配信
    return context.next();
  }

  // ── その他のパス → パススルー ────────────────────────────────
  return context.next();
}
