import http2 from 'http2';
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

function fetchViaHttp2({
  url,
  method = 'GET',
  headers = {},
  bodyBuffer,
  redirect = 'follow',
  timeoutMs = 22000,
  redirectsLeft = 8,
}) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let client;
    let req;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (req && typeof req.destroy === 'function') req.destroy();
        if (client && typeof client.close === 'function') client.close();
        reject(new Error('HTTP/2 proxy timeout'));
      }
    }, timeoutMs);

    try {
      const parsed = new URL(url);
      client = http2.connect(parsed.origin);

      client.on('error', err => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          reject(err);
        }
      });

      const upperMethod = String(method).toUpperCase();
      const h2Headers = {
        ':method': upperMethod,
        ':path': parsed.pathname + parsed.search,
      };

      for (const [k, v] of Object.entries(headers)) {
        const lower = k.toLowerCase();
        if (
          lower === 'host' ||
          lower === 'connection' ||
          lower === 'keep-alive' ||
          lower === 'transfer-encoding' ||
          lower === 'upgrade' ||
          lower === 'http2-settings' ||
          lower === 'accept-encoding'
        ) {
          continue;
        }
        h2Headers[lower] = String(v);
      }

      if (bodyBuffer && bodyBuffer.length > 0 && upperMethod !== 'GET' && upperMethod !== 'HEAD') {
        h2Headers['content-length'] = String(bodyBuffer.length);
      }

      req = client.request(h2Headers);
      let respHeaders = {};
      const chunks = [];

      req.on('response', h => {
        respHeaders = h;
      });

      req.on('data', chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      req.on('end', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          if (client && typeof client.close === 'function') client.close();
          const statusCode = Number(respHeaders[':status'] || 200);

          if (
            redirect !== 'manual' &&
            statusCode >= 300 &&
            statusCode < 400 &&
            respHeaders['location'] &&
            redirectsLeft > 0
          ) {
            const nextUrl = new URL(
              String(respHeaders['location']),
              url,
            ).toString();
            const nextMethod =
              statusCode === 307 || statusCode === 308 ? upperMethod : 'GET';
            const nextBody =
              statusCode === 307 || statusCode === 308 ? bodyBuffer : undefined;
            return resolve(
              fetchViaHttp2({
                url: nextUrl,
                method: nextMethod,
                headers,
                bodyBuffer: nextBody,
                redirect,
                timeoutMs,
                redirectsLeft: redirectsLeft - 1,
              }),
            );
          }

          const cleanHeaders = {};
          for (const [hk, hv] of Object.entries(respHeaders)) {
            if (hk.startsWith(':') || hv === undefined) continue;
            cleanHeaders[hk.toLowerCase()] = hv;
          }

          resolve({
            status: statusCode,
            statusText: '',
            headers: cleanHeaders,
            data: Buffer.concat(chunks),
            finalUrl: url,
          });
        }
      });

      req.on('error', err => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          if (client && typeof client.close === 'function') client.close();
          reject(err);
        }
      });

      if (bodyBuffer && bodyBuffer.length > 0 && upperMethod !== 'GET' && upperMethod !== 'HEAD') {
        req.write(bodyBuffer);
      }
      req.end();
    } catch (err) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        if (client && typeof client.close === 'function') client.close();
        reject(err);
      }
    }
  });
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
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Ch-Ua':
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1',
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

    const isKnownH2Host =
      url.includes('hakunaymatata.com') ||
      url.includes('aoneroom.com') ||
      url.includes('bcdnxw') ||
      url.includes('moviebox');

    let response;
    if (isKnownH2Host) {
      try {
        response = await fetchViaHttp2({
          url,
          method,
          headers: outgoingHeaders,
          bodyBuffer,
          redirect,
          timeoutMs: 22000,
        });
      } catch {
        response = undefined;
      }
    }

    if (!response || response.status === 426 || response.status === 428) {
      const axiosRes = await axios.request({
        url,
        method: String(method).toUpperCase(),
        headers: outgoingHeaders,
        data: bodyBuffer,
        responseType: 'arraybuffer',
        maxRedirects: redirect === 'manual' ? 0 : 8,
        validateStatus: () => true,
        timeout: 22000,
        httpsAgent,
      });

      if ((axiosRes.status === 426 || axiosRes.status === 428) && !isKnownH2Host) {
        try {
          response = await fetchViaHttp2({
            url,
            method,
            headers: outgoingHeaders,
            bodyBuffer,
            redirect,
            timeoutMs: 22000,
          });
        } catch {
          response = axiosRes;
        }
      } else {
        response = axiosRes;
      }
    }

    // If Cloudflare/WAF blocks AWS Lambda IP (403 / 429 / 503 or CF challenge HTML) on GET, relay via public fetch proxies
    const upperMethod = String(method).toUpperCase();
    const rawPreview = Buffer.isBuffer(response.data)
      ? response.data.slice(0, 1024).toString('utf8')
      : Buffer.from(response.data || []).slice(0, 1024).toString('utf8');
    const isCfChallenge =
      response.status === 403 ||
      response.status === 429 ||
      response.status === 503 ||
      String(response.headers?.['cf-mitigated'] || '').includes('challenge') ||
      rawPreview.includes('<title>Just a moment...</title>') ||
      rawPreview.includes('Attention Required! | Cloudflare');

    if (upperMethod === 'GET' && isCfChallenge) {
      const tryAllOrigins = async () => {
        const aoRes = await axios.get(
          `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
          {timeout: 7000, validateStatus: () => true},
        );
        const contents = aoRes.data?.contents;
        const httpCode = Number(aoRes.data?.status?.http_code || 0);
        if (
          aoRes.status === 200 &&
          typeof contents === 'string' &&
          contents.length > 0 &&
          httpCode >= 200 &&
          httpCode < 400 &&
          !contents.includes('<title>Just a moment...</title>')
        ) {
          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              status: httpCode,
              statusText: 'OK',
              url: aoRes.data?.status?.url || url,
              headers: {
                'content-type':
                  aoRes.data?.status?.content_type ||
                  'text/html; charset=utf-8',
              },
              bodyBase64: Buffer.from(contents, 'utf8').toString('base64'),
            }),
          };
        }
        throw new Error('AllOrigins relay blocked');
      };

      const tryCodetabs = async () => {
        const ctRes = await axios.get(
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
          {
            responseType: 'arraybuffer',
            timeout: 7000,
            validateStatus: () => true,
          },
        );
        if (ctRes.status >= 200 && ctRes.status < 400 && ctRes.data) {
          const buf = Buffer.isBuffer(ctRes.data)
            ? ctRes.data
            : Buffer.from(ctRes.data);
          const preview = buf.slice(0, 512).toString('utf8');
          if (!preview.includes('<title>Just a moment...</title>')) {
            return {
              statusCode: 200,
              headers: CORS_HEADERS,
              body: JSON.stringify({
                status: ctRes.status,
                statusText: 'OK',
                url,
                headers: {
                  'content-type':
                    String(ctRes.headers['content-type'] || '') ||
                    'text/html; charset=utf-8',
                },
                bodyBase64: buf.toString('base64'),
              }),
            };
          }
        }
        throw new Error('Codetabs relay blocked');
      };

      try {
        return await Promise.any([tryAllOrigins(), tryCodetabs()]);
      } catch {
        // Fall through to original upstream response
      }
    }

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
      response.finalUrl ||
      response.request?.res?.responseUrl ||
      response.config?.url ||
      url;
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
