import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function parseEncodedHeaders(encodedHeaders) {
  const customHeaders = {};
  if (!encodedHeaders) return customHeaders;
  try {
    const decoded = Buffer.from(encodedHeaders, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          customHeaders[k] = String(v);
        }
      }
    }
  } catch {
    // Ignore malformed base64 headers
  }
  return customHeaders;
}

function rewriteM3u8Playlist(playlistText, baseUrl, encodedHeaders) {
  const buildProxyUrl = rawTarget => {
    try {
      const resolved = new URL(rawTarget.trim(), baseUrl).toString();
      const params = new URLSearchParams();
      params.set('url', resolved);
      if (encodedHeaders) {
        params.set('headers', encodedHeaders);
      }
      return `/api/stream-proxy?${params.toString()}`;
    } catch {
      return rawTarget;
    }
  };

  return playlistText
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          return `URI="${buildProxyUrl(uri)}"`;
        });
      }
      return buildProxyUrl(trimmed);
    })
    .join('\n');
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
      body: '',
    };
  }

  try {
    const targetUrl = String(event.queryStringParameters?.url || '').trim();
    const encodedHeaders = String(
      event.queryStringParameters?.headers || '',
    ).trim();

    if (!targetUrl) {
      return {
        statusCode: 400,
        headers: {'Access-Control-Allow-Origin': '*'},
        body: 'Missing url query parameter',
      };
    }

    const customHeaders = parseEncodedHeaders(encodedHeaders);
    const outgoingHeaders = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: '*/*',
    };

    for (const [k, v] of Object.entries(customHeaders)) {
      const lower = k.toLowerCase();
      if (lower === 'host' || lower === 'connection') continue;
      outgoingHeaders[k] = v;
    }

    const incomingRange =
      event.headers?.range || event.headers?.Range || undefined;
    if (incomingRange) {
      outgoingHeaders['Range'] = incomingRange;
    }

    // First check if this is a non-HLS direct container file (> 4MB) by doing a fast HEAD/small check or checking extension
    const lowerUrlPath = targetUrl.split('?')[0].toLowerCase();
    const isLikelyM3u8 =
      lowerUrlPath.endsWith('.m3u8') ||
      targetUrl.toLowerCase().includes('m3u8');
    const isSegmentOrSub =
      lowerUrlPath.endsWith('.ts') ||
      lowerUrlPath.endsWith('.m4s') ||
      lowerUrlPath.endsWith('.vtt') ||
      lowerUrlPath.endsWith('.srt') ||
      lowerUrlPath.endsWith('.key');

    // If it's a large container video (MP4/MKV) on Netlify Serverless (which has a 6MB response cap),
    // resolve any redirects and issue a 302 redirect to the final signed CDN URL
    if (!isLikelyM3u8 && !isSegmentOrSub) {
      try {
        const headRes = await axios.head(targetUrl, {
          headers: outgoingHeaders,
          maxRedirects: 8,
          validateStatus: () => true,
          timeout: 10000,
          httpsAgent,
        });
        const finalUrl =
          headRes.request?.res?.responseUrl ||
          headRes.config?.url ||
          targetUrl;
        const ct = String(headRes.headers['content-type'] || '').toLowerCase();
        const cl = Number(headRes.headers['content-length'] || 0);
        if (
          !ct.includes('mpegurl') &&
          (cl > 4.5 * 1024 * 1024 ||
            ct.includes('video/') ||
            ct.includes('matroska') ||
            ct.includes('octet-stream'))
        ) {
          return {
            statusCode: 302,
            headers: {
              Location: finalUrl,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache',
            },
            body: '',
          };
        }
      } catch {
        // Continue to standard fetch
      }
    }

    const upstream = await axios.get(targetUrl, {
      headers: outgoingHeaders,
      responseType: 'arraybuffer',
      maxRedirects: 8,
      validateStatus: () => true,
      timeout: 25000,
      httpsAgent,
    });

    const finalUrl =
      upstream.request?.res?.responseUrl || upstream.config?.url || targetUrl;
    const contentType = String(
      upstream.headers['content-type'] || '',
    ).toLowerCase();

    const isM3u8 =
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegurl') ||
      finalUrl.split('?')[0].toLowerCase().endsWith('.m3u8') ||
      isLikelyM3u8;

    const rawBuffer = Buffer.isBuffer(upstream.data)
      ? upstream.data
      : Buffer.from(upstream.data || []);

    if (isM3u8 && upstream.status >= 200 && upstream.status < 300) {
      const rawText = rawBuffer.toString('utf8');
      if (rawText.trimStart().startsWith('#EXTM3U')) {
        const rewritten = rewriteM3u8Playlist(
          rawText,
          finalUrl,
          encodedHeaders,
        );
        return {
          statusCode: upstream.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache',
          },
          body: rewritten,
        };
      }
    }

    return {
      statusCode: upstream.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type':
          upstream.headers['content-type'] || 'application/octet-stream',
        'Cache-Control': upstream.headers['cache-control'] || 'public, max-age=3600',
      },
      body: rawBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: {'Access-Control-Allow-Origin': '*'},
      body: err?.message || 'Stream proxy error',
    };
  }
}
