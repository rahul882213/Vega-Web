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

let cachedModflixMap = null;
let cachedModflixAt = 0;
const MODFLIX_TTL_MS = 60 * 60 * 1000;

async function fetchModflixBaseUrls() {
  const now = Date.now();
  if (cachedModflixMap && now - cachedModflixAt < MODFLIX_TTL_MS) {
    return cachedModflixMap;
  }
  try {
    const res = await axios.get(
      'https://himanshu8443.github.io/providers/modflix.json',
      {
        timeout: 12000,
        httpsAgent,
        headers: {'User-Agent': DEFAULT_USER_AGENT},
      },
    );
    if (res.data && typeof res.data === 'object') {
      cachedModflixMap = res.data;
      cachedModflixAt = now;
      return cachedModflixMap;
    }
  } catch {
    // Ignore error and return cached or empty map
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
