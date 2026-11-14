import {cacheStorageService, getEffectiveApiBaseUrl} from '../storage';

const EXPIRE_TIME = 60 * 60 * 1000;
const ZENDA_URLS_JSON_URL =
  'https://raw.githubusercontent.com/Zenda-Cross/vega-providers/refs/heads/main/urls.json';
const PUNISHER_MODFLIX_JSON_URL =
  'https://raw.githubusercontent.com/punisher-303/providers/main/modflix.json';

const STALE_URL_HOSTS = [
  'one.cinevood.business',
  'animesalt.cx',
  'moviesleech.club',
  'world4ufree.vu',
  'world4ufree.beer',
  'ex5wfv.movielinkbd.li',
];

const FALLBACK_LIVE_MIRRORS: Record<string, BaseUrlEntry> = {
  w4u: {name: 'world4ufree', url: 'https://new2.world4ufree.watch'},
  movielinkbd: {name: 'movielinkbd', url: 'https://y85rfw.movielinkbd.at'},
  movielinkdb: {name: 'movielinkbd', url: 'https://y85rfw.movielinkbd.at'},
};

interface BaseUrlEntry {
  name?: string;
  url: string;
}

let memoryModflixCache: Record<string, BaseUrlEntry> | null = null;
let memoryModflixFetchedAt = 0;

function isStaleUrl(raw?: string | null): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return STALE_URL_HOSTS.some(bad => lower.includes(bad));
}

async function fetchModflixDirect(): Promise<Record<string, BaseUrlEntry>> {
  if (
    memoryModflixCache &&
    Date.now() - memoryModflixFetchedAt < EXPIRE_TIME
  ) {
    return memoryModflixCache;
  }

  const [zendaRes, punisherRes] = await Promise.allSettled([
    fetch(ZENDA_URLS_JSON_URL, {cache: 'no-store'}).then(r =>
      r.ok ? r.json() : null,
    ),
    fetch(PUNISHER_MODFLIX_JSON_URL, {cache: 'no-store'}).then(r =>
      r.ok ? r.json() : null,
    ),
  ]);

  const zendaMap: Record<string, BaseUrlEntry> =
    zendaRes.status === 'fulfilled' &&
    zendaRes.value &&
    typeof zendaRes.value === 'object'
      ? (zendaRes.value as Record<string, BaseUrlEntry>)
      : {};

  const punisherMap: Record<string, BaseUrlEntry> =
    punisherRes.status === 'fulfilled' &&
    punisherRes.value &&
    typeof punisherRes.value === 'object'
      ? (punisherRes.value as Record<string, BaseUrlEntry>)
      : {};

  const merged: Record<string, BaseUrlEntry> = {
    ...punisherMap,
    ...zendaMap,
    ...FALLBACK_LIVE_MIRRORS,
  };
  for (const [k, entry] of Object.entries(merged)) {
    const rawUrl = String(entry?.url || '').toLowerCase();
    if (STALE_URL_HOSTS.some(bad => rawUrl.includes(bad))) {
      const alt =
        FALLBACK_LIVE_MIRRORS[k] ||
        punisherMap[k] ||
        Object.entries(punisherMap).find(
          ([pk]) => pk.toLowerCase() === k.toLowerCase(),
        )?.[1];
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
  return memoryModflixCache || {};
}

export const getBaseUrl = async (providerValue: string): Promise<string> => {
  const cacheKey = 'CacheBaseUrl' + providerValue;
  const timeKey = 'baseUrlTime' + providerValue;

  try {
    const cachedUrl = cacheStorageService.getString(cacheKey);
    const cachedTime = cacheStorageService.getObject<number>(timeKey);

    if (
      cachedUrl &&
      !isStaleUrl(cachedUrl) &&
      cachedTime &&
      Date.now() - cachedTime < EXPIRE_TIME
    ) {
      return cachedUrl;
    }

    // 1. Try backend /api/base-url endpoint
    try {
      const apiPrefix = getEffectiveApiBaseUrl();
      const res = await fetch(
        `${apiPrefix}/api/base-url?provider=${encodeURIComponent(providerValue)}`,
      );
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
      // Fall through to direct GitHub Pages lookup
    }

    // 2. Fallback: Fetch modflix.json directly in browser (CORS-enabled on GitHub Pages)
    const map = await fetchModflixDirect();
    const entry =
      map[providerValue] ||
      Object.entries(map).find(
        ([k]) => k.toLowerCase() === providerValue.toLowerCase(),
      )?.[1];

    if (entry?.url && typeof entry.url === 'string') {
      cacheStorageService.setString(cacheKey, entry.url);
      cacheStorageService.setObject(timeKey, Date.now());
      return entry.url;
    }

    return cachedUrl || '';
  } catch (error) {
    console.error(`Error fetching baseUrl for ${providerValue}:`, error);
    return cacheStorageService.getString(cacheKey) || '';
  }
};
