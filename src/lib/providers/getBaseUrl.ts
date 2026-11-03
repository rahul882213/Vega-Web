import {cacheStorageService} from '../storage';

const EXPIRE_TIME = 60 * 60 * 1000;

export const getBaseUrl = async (providerValue: string): Promise<string> => {
  try {
    const cacheKey = 'CacheBaseUrl' + providerValue;
    const timeKey = 'baseUrlTime' + providerValue;

    const cachedUrl = cacheStorageService.getString(cacheKey);
    const cachedTime = cacheStorageService.getObject<number>(timeKey);

    if (cachedUrl && cachedTime && Date.now() - cachedTime < EXPIRE_TIME) {
      return cachedUrl;
    }

    const res = await fetch(
      `/api/base-url?provider=${encodeURIComponent(providerValue)}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.url && typeof data.url === 'string') {
        cacheStorageService.setString(cacheKey, data.url);
        cacheStorageService.setObject(timeKey, Date.now());
        return data.url;
      }
    }
    return cachedUrl || '';
  } catch (error) {
    console.error(`Error fetching baseUrl for ${providerValue}:`, error);
    return '';
  }
};
