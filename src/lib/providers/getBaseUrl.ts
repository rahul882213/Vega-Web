import {
  cacheStorageService,
  extensionStorage,
  getEffectiveApiBaseUrl,
  isStaticOrGitHubPagesHost,
  settingsStorage,
} from '../storage';

const EXPIRE_TIME = 60 * 60 * 1000;
const ENRICH_CACHE_TTL = 10 * 60 * 1000;
const SOURCE_URLS_CACHE_TTL = 30 * 60 * 1000;
const ZENDA_URLS_JSON_URL =
  'https://raw.githubusercontent.com/Zenda-Cross/vega-providers/refs/heads/main/urls.json';
const PUNISHER_MODFLIX_JSON_URL =
  'https://raw.githubusercontent.com/punisher-303/providers/main/modflix.json';

export const STALE_URL_HOSTS = [
  'one.cinevood.business',
  'animesalt.cx',
  'moviesleech.club',
  'world4ufree.vu',
  'world4ufree.beer',
  'ex5wfv.movielinkbd.li',
];

export const FALLBACK_LIVE_MIRRORS: Record<string, BaseUrlEntry> = {
  w4u: {name: 'world4ufree', url: 'https://new2.world4ufree.watch'},
  movielinkbd: {name: 'movielinkbd', url: 'https://y85rfw.movielinkbd.at'},
  movielinkdb: {name: 'movielinkbd', url: 'https://y85rfw.movielinkbd.at'},
};

export interface BaseUrlEntry {
  name?: string;
  url: string;
}

let memoryModflixCache: Record<string, BaseUrlEntry> | null = null;
let memoryModflixFetchedAt = 0;
let inflightModflixPromise: Promise<Record<string, BaseUrlEntry>> | null = null;

const sourceUrlsCache = new Map<
  string,
  {at: number; map: Record<string, BaseUrlEntry>}
>();
const inflightSourceUrls = new Map<
  string,
  Promise<Record<string, BaseUrlEntry>>
>();

export function isStaleUrl(raw?: string | null): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return STALE_URL_HOSTS.some(bad => lower.includes(bad));
}

function getProxyEndpoint(): string {
  if (isStaticOrGitHubPagesHost()) {
    return `${settingsStorage.getRemoteBackendUrl()}/api/proxy`;
  }
  return '/api/proxy';
}

function decodeBase64Utf8(b64: string): string {
  try {
    const bin = atob(b64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

async function resolvePortalUrlViaProxy(
  portalUrl: string,
  pattern: RegExp,
  fallbackUrl: string,
): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(getProxyEndpoint(), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url: portalUrl, method: 'GET', redirect: 'follow'}),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data?.status >= 200 && data?.status < 400 && data?.bodyBase64) {
        const html = decodeBase64Utf8(data.bodyBase64);
        const portalBase = portalUrl.replace(/\/+$/, '').toLowerCase();
        const matches =
          html.match(new RegExp(pattern.source, 'gi')) || [];
        const liveMatch = matches.find(m => {
          const clean = m.replace(/\/+$/, '').toLowerCase();
          return clean !== portalBase && !isStaleUrl(clean);
        });
        if (liveMatch) {
          return liveMatch.replace(/\/+$/, '');
        }
      }
    }
  } catch {
    // Fall back to verified mirror
  }
  return fallbackUrl;
}

async function fetchJsonDirectOrProxy(
  url: string,
  timeoutMs: number,
): Promise<Record<string, BaseUrlEntry> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data as Record<string, BaseUrlEntry>;
      }
    }
  } catch {
    // Fall back to proxy below
  } finally {
    clearTimeout(timer);
  }

  try {
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), timeoutMs);
    const proxyRes = await fetch(getProxyEndpoint(), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url, method: 'GET', redirect: 'follow'}),
      signal: controller2.signal,
    }).finally(() => clearTimeout(timer2));
    if (proxyRes.ok) {
      const payload = await proxyRes.json();
      if (payload?.status >= 200 && payload?.status < 300 && payload?.bodyBase64) {
        const parsed = JSON.parse(decodeBase64Utf8(payload.bodyBase64));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, BaseUrlEntry>;
        }
      }
    }
  } catch {
    // Ignore fallback failure
  }
  return null;
}

async function getSourceUrlsMap(
  sourceAuthor?: string,
): Promise<Record<string, BaseUrlEntry> | null> {
  const normalizedAuthor = (sourceAuthor || '').trim();
  if (
    !normalizedAuthor ||
    normalizedAuthor.toLowerCase() === 'zenda-cross' ||
    normalizedAuthor.toLowerCase() === 'default'
  ) {
    return null;
  }

  const matchedSource = extensionStorage
    .getProviderSources()
    .find(s => s.author.toLowerCase() === normalizedAuthor.toLowerCase());
  const sourceBaseUrl = matchedSource?.url?.replace(/\/+$/, '');
  if (!sourceBaseUrl) {
    return null;
  }

  const cacheKey = sourceBaseUrl.toLowerCase();
  const cached = sourceUrlsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SOURCE_URLS_CACHE_TTL) {
    return cached.map;
  }

  const inflight = inflightSourceUrls.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const promise = (async () => {
    const rawMap = await fetchJsonDirectOrProxy(`${sourceBaseUrl}/urls.json`, 8000);
    if (rawMap && Object.keys(rawMap).length > 0) {
      sourceUrlsCache.set(cacheKey, {at: Date.now(), map: rawMap});
      return rawMap;
    }
    return cached?.map || {};
  })().finally(() => {
    inflightSourceUrls.delete(cacheKey);
  });

  inflightSourceUrls.set(cacheKey, promise);
  return promise;
}

function findUrlEntry(
  map: Record<string, BaseUrlEntry>,
  providerValue: string,
): BaseUrlEntry | undefined {
  if (!map || !providerValue) return undefined;
  return (
    map[providerValue] ||
    Object.entries(map).find(
      ([k]) => k.toLowerCase() === providerValue.toLowerCase(),
    )?.[1]
  );
}

async function buildEnrichedModflixMap(): Promise<Record<string, BaseUrlEntry>> {
  const fetchJson = async (url: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const [zendaRes, punisherRes, liveW4uUrl, liveMlbdUrl] = await Promise.all([
    fetchJson(ZENDA_URLS_JSON_URL, 8000),
    fetchJson(PUNISHER_MODFLIX_JSON_URL, 6000),
    resolvePortalUrlViaProxy(
      'https://world4ufree.vu/',
      /https:\/\/[a-z0-9.-]*world4ufree\.[a-z]{2,}/i,
      FALLBACK_LIVE_MIRRORS.w4u.url,
    ),
    resolvePortalUrlViaProxy(
      'https://movielinkbd.com/',
      /https:\/\/[a-z0-9-]+\.movielinkbd\.[a-z]{2,}/i,
      FALLBACK_LIVE_MIRRORS.movielinkbd.url,
    ),
  ]);

  const zendaMap: Record<string, BaseUrlEntry> =
    zendaRes && typeof zendaRes === 'object'
      ? (zendaRes as Record<string, BaseUrlEntry>)
      : {};

  const punisherMap: Record<string, BaseUrlEntry> =
    punisherRes && typeof punisherRes === 'object'
      ? (punisherRes as Record<string, BaseUrlEntry>)
      : {};

  const liveMirrors: Record<string, BaseUrlEntry> = {
    w4u: {name: 'world4ufree', url: liveW4uUrl || FALLBACK_LIVE_MIRRORS.w4u.url},
    movielinkbd: {
      name: 'movielinkbd',
      url: liveMlbdUrl || FALLBACK_LIVE_MIRRORS.movielinkbd.url,
    },
    movielinkdb: {
      name: 'movielinkbd',
      url: liveMlbdUrl || FALLBACK_LIVE_MIRRORS.movielinkdb.url,
    },
  };

  const merged: Record<string, BaseUrlEntry> = {
    ...punisherMap,
    ...zendaMap,
    ...liveMirrors,
  };

  for (const [k, entry] of Object.entries(merged)) {
    const rawUrl = String(entry?.url || '').toLowerCase();
    if (STALE_URL_HOSTS.some(bad => rawUrl.includes(bad))) {
      const alt =
        liveMirrors[k] ||
        punisherMap[k] ||
        Object.entries(punisherMap).find(
          ([pk]) => pk.toLowerCase() === k.toLowerCase(),
        )?.[1] ||
        FALLBACK_LIVE_MIRRORS[k];
      if (alt?.url && !isStaleUrl(alt.url)) {
        merged[k] = alt;
      }
    }
  }

  if (Object.keys(merged).length > 0) {
    memoryModflixCache = merged;
    memoryModflixFetchedAt = Date.now();
    return merged;
  }
  return memoryModflixCache || liveMirrors;
}

export async function getEnrichedUrlsMap(
  forceRefresh = false,
): Promise<Record<string, BaseUrlEntry>> {
  if (
    !forceRefresh &&
    memoryModflixCache &&
    Date.now() - memoryModflixFetchedAt < ENRICH_CACHE_TTL
  ) {
    return memoryModflixCache;
  }
  if (!forceRefresh && inflightModflixPromise) {
    return inflightModflixPromise;
  }
  const promise = buildEnrichedModflixMap().finally(() => {
    if (inflightModflixPromise === promise) {
      inflightModflixPromise = null;
    }
  });
  inflightModflixPromise = promise;
  return promise;
}

export const getBaseUrl = async (
  providerValue: string,
  sourceAuthor?: string,
): Promise<string> => {
  const effectiveAuthor =
    (sourceAuthor || extensionStorage.getDefaultProviderSource()?.author || 'default')
      .trim()
      .toLowerCase();
  const isCustomNonZendaSource =
    Boolean(effectiveAuthor) &&
    effectiveAuthor !== 'zenda-cross' &&
    effectiveAuthor !== 'default';

  const cacheKey = `CacheBaseUrl:${effectiveAuthor}:${providerValue}`;
  const timeKey = `baseUrlTime:${effectiveAuthor}:${providerValue}`;

  try {
    const cachedUrl = cacheStorageService.getString(cacheKey);
    const cachedTime = cacheStorageService.getObject<number>(timeKey);

    if (cachedUrl && isStaleUrl(cachedUrl)) {
      cacheStorageService.delete(cacheKey);
      cacheStorageService.delete(timeKey);
    } else if (
      cachedUrl &&
      cachedTime &&
      Date.now() - cachedTime < EXPIRE_TIME
    ) {
      return cachedUrl;
    }

    // 1. For non-Zenda sources (e.g. rahul882213), resolve directly from that source's own urls.json first
    if (isCustomNonZendaSource) {
      const sourceMap = await getSourceUrlsMap(sourceAuthor || effectiveAuthor);
      const sourceEntry = sourceMap
        ? findUrlEntry(sourceMap, providerValue)
        : undefined;
      if (
        sourceEntry?.url &&
        typeof sourceEntry.url === 'string' &&
        !isStaleUrl(sourceEntry.url)
      ) {
        const cleanUrl = sourceEntry.url.trim().replace(/\/+$/, '');
        cacheStorageService.setString(cacheKey, cleanUrl);
        cacheStorageService.setObject(timeKey, Date.now());
        return cleanUrl;
      }
    }

    // 2. Try backend /api/base-url endpoint (Zenda-Cross / Punisher mirrors)
    try {
      const apiPrefix = getEffectiveApiBaseUrl();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `${apiPrefix}/api/base-url?provider=${encodeURIComponent(providerValue)}`,
        {signal: controller.signal},
      ).finally(() => clearTimeout(timer));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (
          data?.url &&
          typeof data.url === 'string' &&
          !isStaleUrl(data.url)
        ) {
          cacheStorageService.setString(cacheKey, data.url);
          cacheStorageService.setObject(timeKey, Date.now());
          return data.url;
        }
      }
    } catch {
      // Fall through to direct GitHub + portal lookup
    }

    // 3. Fallback: Fetch & enrich Zenda urls.json directly in browser
    const map = await getEnrichedUrlsMap();
    const entry = findUrlEntry(map, providerValue);

    if (entry?.url && typeof entry.url === 'string') {
      cacheStorageService.setString(cacheKey, entry.url);
      cacheStorageService.setObject(timeKey, Date.now());
      return entry.url;
    }

    return cachedUrl && !isStaleUrl(cachedUrl) ? cachedUrl : '';
  } catch (error) {
    console.error(`Error fetching baseUrl for ${providerValue}:`, error);
    const fallback = cacheStorageService.getString(cacheKey);
    return fallback && !isStaleUrl(fallback) ? fallback : '';
  }
};


