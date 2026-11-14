import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json',
};

const ZENDA_URLS_JSON =
  'https://raw.githubusercontent.com/Zenda-Cross/vega-providers/refs/heads/main/urls.json';
const PUNISHER_MODFLIX_JSON =
  'https://raw.githubusercontent.com/punisher-303/providers/main/modflix.json';

const STALE_URL_HOSTS = [
  'one.cinevood.business',
  'animesalt.in',
  'moviesleech.club',
  'world4ufree.vu',
];

let cachedModflixMap = null;
let cachedModflixAt = 0;
const MODFLIX_TTL_MS = 60 * 60 * 1000;

async function fetchModflixBaseUrls() {
  const now = Date.now();
  if (cachedModflixMap && now - cachedModflixAt < MODFLIX_TTL_MS) {
    return cachedModflixMap;
  }
  const [zendaRes, punisherRes] = await Promise.allSettled([
    axios.get(ZENDA_URLS_JSON, {
      timeout: 10000,
      httpsAgent,
      headers: {'User-Agent': DEFAULT_USER_AGENT},
    }),
    axios.get(PUNISHER_MODFLIX_JSON, {
      timeout: 10000,
      httpsAgent,
      headers: {'User-Agent': DEFAULT_USER_AGENT},
    }),
  ]);

  const zendaMap =
    zendaRes.status === 'fulfilled' &&
    zendaRes.value.data &&
    typeof zendaRes.value.data === 'object'
      ? zendaRes.value.data
      : {};

  const punisherMap =
    punisherRes.status === 'fulfilled' &&
    punisherRes.value.data &&
    typeof punisherRes.value.data === 'object'
      ? punisherRes.value.data
      : {};

  const merged = {...punisherMap, ...zendaMap};
  for (const [k, entry] of Object.entries(merged)) {
    const rawUrl = String(entry?.url || '').toLowerCase();
    if (STALE_URL_HOSTS.some(bad => rawUrl.includes(bad))) {
      const alt =
        punisherMap[k] ||
        Object.entries(punisherMap).find(
          ([pk]) => pk.toLowerCase() === k.toLowerCase(),
        )?.[1];
      if (alt?.url) {
        merged[k] = alt;
      }
    }
  }

  if (Object.keys(merged).length > 0) {
    cachedModflixMap = merged;
    cachedModflixAt = now;
    return merged;
  }
  return cachedModflixMap || {};
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  try {
    const providerValue = String(
      event.queryStringParameters?.provider || '',
    ).trim();
    const map = await fetchModflixBaseUrls();
    if (!providerValue) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(map),
      };
    }

    const entry =
      map[providerValue] ||
      Object.entries(map).find(
        ([k]) => k.toLowerCase() === providerValue.toLowerCase(),
      )?.[1];

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        provider: providerValue,
        url: entry?.url || '',
        name: entry?.name || providerValue,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to resolve base URL',
      }),
    };
  }
}
