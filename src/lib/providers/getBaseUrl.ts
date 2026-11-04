import {cacheStorageService, getEffectiveApiBaseUrl} from '../storage';

const EXPIRE_TIME = 60 * 60 * 1000;
const MODFLIX_JSON_URL = 'https://himanshu8443.github.io/providers/modflix.json';

interface BaseUrlEntry {
  name?: string;
  url: string;
}

let memoryModflixCache: Record<string, BaseUrlEntry> | null = null;
let memoryModflixFetchedAt = 0;

async function fetchModflixDirect(): Promise<Record<string, BaseUrlEntry>> {
  if (
    memoryModflixCache &&
    Date.now() - memoryModflixFetchedAt < EXPIRE_TIME
  ) {
    return memoryModflixCache;
  }
  const res = await fetch(MODFLIX_JSON_URL, {cache: 'no-store'});
  if (res.ok) {
    const data = await res.json();
    if (data && typeof data === 'object') {
      memoryModflixCache = data as Record<string, BaseUrlEntry>;
      memoryModflixFetchedAt = Date.now();
      return memoryModflixCache;
    }
  }
  return memoryModflixCache || {};
}

export const getBaseUrl = async (providerValue: string): Promise<string> => {
  const cacheKey = 'CacheBaseUrl' + providerValue;
  const timeKey = 'baseUrlTime' + providerValue;

  try {
    const cachedUrl = cacheStorageService.getString(cacheKey);
    const cachedTime = cacheStorageService.getObject<number>(timeKey);

    if (cachedUrl && cachedTime && Date.now() - cachedTime < EXPIRE_TIME) {
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
        if (data?.url && typeof data.url === 'string') {
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
