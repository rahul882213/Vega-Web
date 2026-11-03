import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 3.5 MB chunk size so base64-encoded body (~4.67 MB) stays safely under Netlify's 6 MB Lambda response limit
const MAX_RANGE_CHUNK_BYTES = 3584 * 1024;

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

function clampRangeHeader(rangeHeader, maxChunk = MAX_RANGE_CHUNK_BYTES) {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
    return `bytes=0-${maxChunk - 1}`;
  }
  const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return `bytes=0-${maxChunk - 1}`;
  }
  const start = parseInt(match[1], 10) || 0;
  const requestedEnd = match[2] ? parseInt(match[2], 10) : NaN;
  const clampedEnd = Number.isFinite(requestedEnd)
    ? Math.min(requestedEnd, start + maxChunk - 1)
    : start + maxChunk - 1;
  return `bytes=${start}-${clampedEnd}`;
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
        'Access-Control-Expose-Headers':
          'Content-Length, Content-Range, Accept-Ranges, Content-Type',
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

    const lowerUrlPath = targetUrl.split('?')[0].toLowerCase();
    const isLikelyM3u8 =
      lowerUrlPath.endsWith('.m3u8') ||
      targetUrl.toLowerCase().includes('.m3u8');
    const isTextSubtitle =
      lowerUrlPath.endsWith('.vtt') || lowerUrlPath.endsWith('.srt');
    const isHlsSegment =
      lowerUrlPath.endsWith('.ts') ||
      lowerUrlPath.endsWith('.m4s') ||
      lowerUrlPath.endsWith('.key');

    const incomingRange =
      event.headers?.range || event.headers?.Range || undefined;

    // For direct MP4/MKV streams (such as MovieBox Web), clamp each HTTP Range request to 3.5 MB
    // so Netlify Functions never exceed the 6 MB response cap while keeping custom Referer/Origin headers intact
    if (!isLikelyM3u8 && !isTextSubtitle && !isHlsSegment) {
      outgoingHeaders['Range'] = clampRangeHeader(incomingRange);
    } else if (incomingRange) {
      outgoingHeaders['Range'] = incomingRange;
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

    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers':
        'Content-Length, Content-Range, Accept-Ranges, Content-Type',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(rawBuffer.length),
    };

    if (upstream.headers['content-range']) {
      responseHeaders['Content-Range'] = String(
        upstream.headers['content-range'],
      );
    }
    if (upstream.headers['etag']) {
      responseHeaders['ETag'] = String(upstream.headers['etag']);
    }
    if (upstream.headers['last-modified']) {
      responseHeaders['Last-Modified'] = String(
        upstream.headers['last-modified'],
      );
    }

    if (
      !contentType ||
      contentType.includes('octet-stream') ||
      contentType.includes('matroska') ||
      contentType.includes('mkv')
    ) {
      responseHeaders['Content-Type'] = 'video/mp4';
    } else {
      responseHeaders['Content-Type'] = String(
        upstream.headers['content-type'],
      );
    }

    return {
      statusCode: upstream.status,
      headers: responseHeaders,
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
