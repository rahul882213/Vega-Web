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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const {
      url,
      method = 'GET',
      headers = {},
      bodyBase64,
      redirect = 'follow',
    } = payload;

    if (!url || typeof url !== 'string') {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({error: 'Missing or invalid url'}),
      };
    }

    const outgoingHeaders = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };

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
          outgoingHeaders[k] = String(v);
        }
      }
    }

    const bodyBuffer =
      typeof bodyBase64 === 'string' && bodyBase64.length > 0
        ? Buffer.from(bodyBase64, 'base64')
        : undefined;

    const response = await axios.request({
      url,
      method: String(method).toUpperCase(),
      headers: outgoingHeaders,
      data: bodyBuffer,
      responseType: 'arraybuffer',
      maxRedirects: redirect === 'manual' ? 0 : 8,
      validateStatus: () => true,
      timeout: 25000,
      httpsAgent,
    });

    const responseHeaders = {};
    for (const [key, val] of Object.entries(response.headers || {})) {
      if (val === undefined) continue;
      if (key.toLowerCase() === 'set-cookie') {
        responseHeaders['set-cookie'] = Array.isArray(val)
          ? val.join('\n')
          : String(val);
      } else if (Array.isArray(val)) {
        responseHeaders[key.toLowerCase()] = val.join(', ');
      } else {
        responseHeaders[key.toLowerCase()] = String(val);
      }
    }

    const finalUrl =
      response.request?.res?.responseUrl || response.config?.url || url;
    const rawBuffer = Buffer.isBuffer(response.data)
      ? response.data
      : Buffer.from(response.data || []);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        status: response.status,
        statusText: response.statusText || '',
        url: finalUrl,
        headers: responseHeaders,
        bodyBase64: rawBuffer.toString('base64'),
      }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Proxy request failed',
      }),
    };
  }
}
