const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json',
};

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  try {
    const payload = await request.json();
    const {
      url,
      method = 'GET',
      headers = {},
      bodyBase64,
      redirect = 'follow',
    } = payload || {};

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({error: 'Missing or invalid url'}), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const outgoingHeaders = new Headers({
      'User-Agent': DEFAULT_USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    });

    if (headers && typeof headers === 'object') {
      for (const [k, v] of Object.entries(headers)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          const lower = k.toLowerCase();
          if (
            lower === 'host' ||
            lower === 'content-length' ||
            lower === 'connection' ||
            lower === 'accept-encoding'
          ) {
            continue;
          }
          outgoingHeaders.set(k, String(v));
        }
      }
    }

    const upperMethod = String(method).toUpperCase();
    const body =
      upperMethod !== 'GET' &&
      upperMethod !== 'HEAD' &&
      typeof bodyBase64 === 'string' &&
      bodyBase64.length > 0
        ? base64ToUint8Array(bodyBase64)
        : undefined;

    const upstream = await fetch(url, {
      method: upperMethod,
      headers: outgoingHeaders,
      body,
      redirect: redirect === 'manual' ? 'manual' : 'follow',
    });

    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    const rawBuf = await upstream.arrayBuffer();

    return new Response(
      JSON.stringify({
        status: upstream.status,
        statusText: upstream.statusText || '',
        url: upstream.url || url,
        headers: responseHeaders,
        bodyBase64: arrayBufferToBase64(rawBuf),
      }),
      {
        status: 200,
        headers: CORS_HEADERS,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error?.message || 'Edge proxy request failed',
      }),
      {
        status: 502,
        headers: CORS_HEADERS,
      },
    );
  }
}

export const config = {
  path: '/api/edge-proxy',
};
