import crypto from 'crypto';
import fs from 'fs';
import {spawn, execFile} from 'child_process';
import {promisify} from 'util';
import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import axios from 'axios';
import https from 'https';
import http2 from 'http2';
import dns from 'dns';
import {SocksProxyAgent} from 'socks-proxy-agent';

const SERVER_PORT = Number(process.env.PORT || 3000);
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface BaseUrlEntry {
  name?: string;
  url: string;
}

const ZENDA_URLS_JSON =
  'https://raw.githubusercontent.com/Zenda-Cross/vega-providers/refs/heads/main/urls.json';
const PUNISHER_MODFLIX_JSON =
  'https://raw.githubusercontent.com/punisher-303/providers/main/modflix.json';

const STALE_URL_HOSTS = [
  'one.cinevood.business',
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

async function resolvePortalUrl(
  portalUrl: string,
  pattern: RegExp,
  fallbackUrl: string,
): Promise<string> {
  try {
    const resp = await axios.get(portalUrl, {
      timeout: 5000,
      httpsAgent,
      headers: {'User-Agent': DEFAULT_USER_AGENT},
      validateStatus: s => s >= 200 && s < 400,
    });
    const html = typeof resp.data === 'string' ? resp.data : '';
    const portalBase = portalUrl.replace(/\/+$/, '').toLowerCase();
    const matches = html.match(new RegExp(pattern.source, 'gi')) || [];
    const liveMatch = matches.find(m => {
      const clean = m.replace(/\/+$/, '').toLowerCase();
      return (
        clean !== portalBase &&
        !STALE_URL_HOSTS.some(bad => clean.includes(bad))
      );
    });
    if (liveMatch) {
      return liveMatch.replace(/\/+$/, '');
    }
  } catch {
    // Fallback to verified live mirror
  }
  return fallbackUrl;
}

let cachedModflixMap: Record<string, BaseUrlEntry> | null = null;
let cachedModflixAt = 0;
const MODFLIX_TTL_MS = 60 * 60 * 1000;

async function fetchModflixBaseUrls(): Promise<Record<string, BaseUrlEntry>> {
  const now = Date.now();
  if (cachedModflixMap && now - cachedModflixAt < MODFLIX_TTL_MS) {
    return cachedModflixMap;
  }
  const [zendaRes, punisherRes, liveW4uUrl, liveMlbdUrl] =
    await Promise.allSettled([
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
      resolvePortalUrl(
        'https://world4ufree.vu/',
        /https:\/\/[a-z0-9.-]*world4ufree\.[a-z]{2,}/i,
        FALLBACK_LIVE_MIRRORS.w4u.url,
      ),
      resolvePortalUrl(
        'https://movielinkbd.com/',
        /https:\/\/[a-z0-9-]+\.movielinkbd\.[a-z]{2,}/i,
        FALLBACK_LIVE_MIRRORS.movielinkbd.url,
      ),
    ]);

  const zendaMap: Record<string, BaseUrlEntry> =
    zendaRes.status === 'fulfilled' &&
    zendaRes.value.data &&
    typeof zendaRes.value.data === 'object'
      ? (zendaRes.value.data as Record<string, BaseUrlEntry>)
      : {};

  const punisherMap: Record<string, BaseUrlEntry> =
    punisherRes.status === 'fulfilled' &&
    punisherRes.value.data &&
    typeof punisherRes.value.data === 'object'
      ? (punisherRes.value.data as Record<string, BaseUrlEntry>)
      : {};

  const merged: Record<string, BaseUrlEntry> = {...punisherMap, ...zendaMap};
  const resolvedW4u =
    liveW4uUrl.status === 'fulfilled'
      ? liveW4uUrl.value
      : FALLBACK_LIVE_MIRRORS.w4u.url;
  const resolvedMlbd =
    liveMlbdUrl.status === 'fulfilled'
      ? liveMlbdUrl.value
      : FALLBACK_LIVE_MIRRORS.movielinkbd.url;

  merged.w4u = {name: 'world4ufree', url: resolvedW4u};
  merged.movielinkbd = {name: 'movielinkbd', url: resolvedMlbd};
  merged.movielinkdb = {name: 'movielinkbd', url: resolvedMlbd};

  for (const [k, entry] of Object.entries(merged)) {
    const rawUrl = String(entry?.url || '').toLowerCase();
    if (STALE_URL_HOSTS.some(bad => rawUrl.includes(bad))) {
      const alt =
        punisherMap[k] ||
        Object.entries(punisherMap).find(
          ([pk]) => pk.toLowerCase() === k.toLowerCase(),
        )?.[1];
      if (alt?.url && !STALE_URL_HOSTS.some(b => alt.url.toLowerCase().includes(b))) {
        merged[k] = alt;
      } else if (FALLBACK_LIVE_MIRRORS[k]) {
        merged[k] = FALLBACK_LIVE_MIRRORS[k];
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

function parseEncodedHeaders(encodedHeaders: string): Record<string, string> {
  const customHeaders: Record<string, string> = {};
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

function buildFfmpegHeadersArg(customHeaders: Record<string, string>): string {
  const merged: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    ...customHeaders,
  };
  const lines: string[] = [];
  for (const [k, v] of Object.entries(merged)) {
    const lower = k.toLowerCase();
    if (lower === 'host' || lower === 'connection' || lower === 'range') {
      continue;
    }
    lines.push(`${k}: ${v}`);
  }
  return lines.length > 0 ? `${lines.join('\r\n')}\r\n` : '';
}

function rewriteM3u8Playlist(
  playlistText: string,
  baseUrl: string,
  encodedHeaders: string,
  proxyOrigin = '',
): string {
  const buildProxyUrl = (rawTarget: string) => {
    try {
      const resolved = new URL(rawTarget.trim(), baseUrl).toString();
      const params = new URLSearchParams();
      params.set('url', resolved);
      if (encodedHeaders) {
        params.set('headers', encodedHeaders);
      }
      return `${proxyOrigin}/api/stream-proxy?${params.toString()}`;
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

export interface ProbedStreamInfo {
  duration: number;
  formatName: string;
  videoCodec: string;
  width: number;
  height: number;
  audioTracks: {
    index: number;
    streamIndex: number;
    codec: string;
    language: string;
    title: string;
    channels: number;
  }[];
  subtitleTracks: {
    index: number;
    streamIndex: number;
    codec: string;
    language: string;
    title: string;
  }[];
}

function isKnownH2OrCdnHost(targetUrl: string): boolean {
  const lower = String(targetUrl || '').toLowerCase();
  return (
    lower.includes('hakunaymatata.com') ||
    lower.includes('aoneroom.com') ||
    lower.includes('bcdnxw') ||
    lower.includes('bcdnw') ||
    lower.includes('moviebox') ||
    lower.includes('enacdn.net')
  );
}

const workingEdgeIpCache = new Map<string, {at: number; ip: string}>();
const alternateEdgeIpsCache = new Map<string, {at: number; ips: string[]}>();
const EDGE_CACHE_TTL_MS = 10 * 60 * 1000;
const ENV_STREAM_PROXY_URL = String(process.env.STREAM_PROXY_URL || '').trim();
const socksAgentCache = new Map<string, SocksProxyAgent>();

function getSocksAgent(proxyUrl: string): SocksProxyAgent {
  let agent = socksAgentCache.get(proxyUrl);
  if (!agent) {
    agent = new SocksProxyAgent(proxyUrl, {
      keepAlive: true,
    });
    socksAgentCache.set(proxyUrl, agent);
  }
  return agent;
}

function mergeCookiesFromSetCookie(
  existingCookie: string | undefined,
  setCookieHeader: string | string[] | undefined,
): string {
  const jar = new Map<string, string>();
  const addCookieString = (str: string) => {
    for (const part of String(str || '').split(';')) {
      const eq = part.indexOf('=');
      if (eq > 0) {
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        if (k) jar.set(k, v);
      }
    }
  };
  if (existingCookie) addCookieString(existingCookie);
  const rawList = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [String(setCookieHeader)]
      : [];
  for (const sc of rawList) {
    const firstPart = String(sc).split(';')[0];
    const eq = firstPart.indexOf('=');
    if (eq > 0) {
      jar.set(firstPart.slice(0, eq).trim(), firstPart.slice(eq + 1).trim());
    }
  }
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function createHostScopedLookup(targetHost: string, overrideIp: string) {
  return (hostname: string, options: any, callback: any) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (
      overrideIp &&
      String(hostname || '').toLowerCase() === String(targetHost || '').toLowerCase()
    ) {
      if (options && options.all) {
        return callback(null, [{address: overrideIp, family: 4}]);
      }
      return callback(null, overrideIp, 4);
    }
    return dns.lookup(hostname, options, callback);
  };
}

function createIpScopedHttpsAgent(targetHost: string, overrideIp: string) {
  if (!overrideIp) return httpsAgent;
  return new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    lookup: createHostScopedLookup(targetHost, overrideIp) as any,
  });
}

async function resolveAlternateEdgeIps(hostname: string): Promise<string[]> {
  const host = String(hostname || '').toLowerCase().trim();
  if (!host) return [];
  const cached = alternateEdgeIpsCache.get(host);
  if (cached && Date.now() - cached.at < EDGE_CACHE_TTL_MS) {
    return cached.ips;
  }

  const ecsSubnets = [
    '203.116.0.0/16',
    '103.21.244.0/24',
    '49.36.0.0/16',
    '185.220.100.0/24',
    '200.160.0.0/16',
  ];

  const results = await Promise.allSettled([
    axios.get(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
      {
        timeout: 3500,
        headers: {Accept: 'application/dns-json'},
        validateStatus: () => true,
      },
    ),
    axios.get(
      `https://dns.alidns.com/resolve?name=${encodeURIComponent(host)}&type=1`,
      {timeout: 3500, validateStatus: () => true},
    ),
    ...ecsSubnets.map(subnet =>
      axios.get(
        `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A&edns_client_subnet=${encodeURIComponent(subnet)}`,
        {timeout: 3500, validateStatus: () => true},
      ),
    ),
  ]);

  const buckets: string[][] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const answers = Array.isArray(r.value?.data?.Answer)
      ? r.value.data.Answer
      : [];
    const list: string[] = [];
    for (const ans of answers) {
      if (ans?.type === 1 && typeof ans.data === 'string') {
        const ip = ans.data.trim();
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
          list.push(ip);
        }
      }
    }
    if (list.length > 0) buckets.push(list);
  }

  const seen = new Set<string>();
  const ips: string[] = [];
  const maxLen = Math.max(0, ...buckets.map(b => b.length));
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) {
      const ip = bucket[i];
      if (ip && !seen.has(ip)) {
        seen.add(ip);
        ips.push(ip);
      }
    }
  }

  if (ips.length > 0) {
    alternateEdgeIpsCache.set(host, {at: Date.now(), ips});
  }
  return ips;
}

function buildLoopbackStreamUrl(
  targetUrl: string,
  customHeaders: Record<string, string>,
): string {
  const params = new URLSearchParams({url: targetUrl});
  if (customHeaders && Object.keys(customHeaders).length > 0) {
    params.set(
      'headers',
      Buffer.from(JSON.stringify(customHeaders)).toString('base64'),
    );
  }
  return `http://127.0.0.1:${SERVER_PORT}/api/stream-proxy?${params.toString()}`;
}

const probeCache = new Map<string, {at: number; info: ProbedStreamInfo}>();

async function runFfprobeOnInput(inputUrl: string, headerStr: string) {
  const args: string[] = [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    '-rw_timeout',
    '15000000',
  ];

  if (headerStr) {
    args.push('-headers', headerStr);
  }
  args.push(inputUrl);

  const {stdout} = await execFileAsync('ffprobe', args, {
    timeout: 18000,
    maxBuffer: 8 * 1024 * 1024,
  });

  return JSON.parse(stdout || '{}');
}

async function probeRemoteStream(
  targetUrl: string,
  customHeaders: Record<string, string>,
): Promise<ProbedStreamInfo> {
  const cacheKey = `${targetUrl}::${JSON.stringify(customHeaders)}`;
  const cached = probeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
    return cached.info;
  }

  let parsed: any;
  if (isKnownH2OrCdnHost(targetUrl)) {
    parsed = await runFfprobeOnInput(
      buildLoopbackStreamUrl(targetUrl, customHeaders),
      '',
    );
  } else {
    try {
      parsed = await runFfprobeOnInput(
        targetUrl,
        buildFfmpegHeadersArg(customHeaders),
      );
    } catch {
      parsed = await runFfprobeOnInput(
        buildLoopbackStreamUrl(targetUrl, customHeaders),
        '',
      );
    }
  }
  const streams: any[] = Array.isArray(parsed.streams) ? parsed.streams : [];
  const format = parsed.format || {};

  const videoStream = streams.find(s => s.codec_type === 'video') || {};
  const audioStreams = streams.filter(s => s.codec_type === 'audio');
  const subtitleStreams = streams.filter(s => s.codec_type === 'subtitle');

  const duration = Number(format.duration || videoStream.duration || 0) || 0;

  const info: ProbedStreamInfo = {
    duration,
    formatName: String(format.format_name || ''),
    videoCodec: String(videoStream.codec_name || '').toLowerCase(),
    width: Number(videoStream.width || 0),
    height: Number(videoStream.height || 0),
    audioTracks: audioStreams.map((a, idx) => ({
      index: idx,
      streamIndex: Number(a.index ?? idx),
      codec: String(a.codec_name || '').toLowerCase(),
      language: String(a.tags?.language || a.tags?.LANGUAGE || 'und'),
      title: String(
        a.tags?.title ||
          a.tags?.TITLE ||
          a.tags?.handler_name ||
          `Audio ${idx + 1}`,
      ),
      channels: Number(a.channels || 2),
    })),
    subtitleTracks: subtitleStreams
      .filter(s => {
        const c = String(s.codec_name || '').toLowerCase();
        // Text-based subtitles that ffmpeg can convert to webvtt
        return (
          c.includes('subrip') ||
          c.includes('srt') ||
          c.includes('ass') ||
          c.includes('ssa') ||
          c.includes('webvtt') ||
          c.includes('mov_text') ||
          c.includes('text')
        );
      })
      .map((s, idx) => ({
        index: idx,
        streamIndex: Number(s.index ?? idx),
        codec: String(s.codec_name || '').toLowerCase(),
        language: String(s.tags?.language || s.tags?.LANGUAGE || 'en'),
        title: String(
          s.tags?.title || s.tags?.TITLE || `Track ${idx + 1}`,
        ),
      })),
  };

  probeCache.set(cacheKey, {at: Date.now(), info});
  return info;
}

async function startServer() {
  const app = express();
  const PORT = SERVER_PORT;
  const rawAllowedOrigins = String(process.env.ALLOWED_ORIGINS || '*').trim();
  const allowedOriginList =
    rawAllowedOrigins === '*'
      ? ['*']
      : rawAllowedOrigins
          .split(',')
          .map(o => o.trim().replace(/\/+$/, ''))
          .filter(Boolean);

  app.set('trust proxy', 1);
  app.use(express.json({limit: '25mb'}));

  app.use('/api', (req, res, next) => {
    const reqOrigin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
    if (allowedOriginList.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (reqOrigin) {
      const matched = allowedOriginList.find(
        o => o.toLowerCase() === reqOrigin.toLowerCase(),
      );
      if (matched) {
        res.setHeader('Access-Control-Allow-Origin', matched);
        res.setHeader('Vary', 'Origin');
      }
    }
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, HEAD, OPTIONS',
    );
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Video-Duration, X-Video-Codec',
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      status: 'healthy',
      service: 'vega-web-server',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  const handleApiProxy = async (req: express.Request, res: express.Response) => {
    try {
      const {
        url,
        method = 'GET',
        headers = {},
        bodyBase64,
        redirect = 'follow',
      } = req.body || {};

      if (!url || typeof url !== 'string') {
        res.status(400).json({error: 'Missing or invalid url'});
        return;
      }

      const outgoingHeaders: Record<string, string> = {
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

      const fetchProxyViaHttp2 = (
        targetUrl: string,
        reqMethod: string,
        reqHeaders: Record<string, string>,
        bodyBuf?: Buffer,
        redirectMode = 'follow',
        redirectsLeft = 8,
        overrideIp = '',
      ): Promise<{
        status: number;
        statusText: string;
        headers: Record<string, string | string[]>;
        data: Buffer;
        finalUrl: string;
      }> =>
        new Promise((resolve, reject) => {
          let resolved = false;
          let client: http2.ClientHttp2Session | undefined;
          let h2Req: http2.ClientHttp2Stream | undefined;
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              h2Req?.destroy();
              client?.close();
              reject(new Error('HTTP/2 proxy timeout'));
            }
          }, 25000);

          try {
            const parsed = new URL(targetUrl);
            const connectOpts: any = {
              rejectUnauthorized: false,
              ...(overrideIp
                ? {lookup: createHostScopedLookup(parsed.hostname, overrideIp)}
                : {}),
            };
            client = http2.connect(parsed.origin, connectOpts);
            client.on('error', err => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                reject(err);
              }
            });

            const upperM = String(reqMethod).toUpperCase();
            const h2Headers: Record<string, string> = {
              ':method': upperM,
              ':scheme': parsed.protocol.replace(':', ''),
              ':authority': parsed.host,
              ':path': parsed.pathname + parsed.search,
            };

            for (const [k, v] of Object.entries(reqHeaders)) {
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

            if (bodyBuf && bodyBuf.length > 0 && upperM !== 'GET' && upperM !== 'HEAD') {
              h2Headers['content-length'] = String(bodyBuf.length);
            }

            h2Req = client.request(h2Headers);
            let respHeaders: Record<string, any> = {};
            const chunks: Buffer[] = [];

            h2Req.on('response', h => {
              respHeaders = h;
            });
            h2Req.on('data', chunk => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            h2Req.on('end', () => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                client?.close();
                const statusCode = Number(respHeaders[':status'] || 200);
                if (
                  redirectMode !== 'manual' &&
                  statusCode >= 300 &&
                  statusCode < 400 &&
                  respHeaders['location'] &&
                  redirectsLeft > 0
                ) {
                  const nextUrl = new URL(
                    String(respHeaders['location']),
                    targetUrl,
                  ).toString();
                  const nextMethod =
                    statusCode === 307 || statusCode === 308 ? upperM : 'GET';
                  const nextBody =
                    statusCode === 307 || statusCode === 308 ? bodyBuf : undefined;
                  return resolve(
                    fetchProxyViaHttp2(
                      nextUrl,
                      nextMethod,
                      reqHeaders,
                      nextBody,
                      redirectMode,
                      redirectsLeft - 1,
                      overrideIp,
                    ),
                  );
                }

                const cleanHeaders: Record<string, string | string[]> = {};
                for (const [hk, hv] of Object.entries(respHeaders)) {
                  if (hk.startsWith(':') || hv === undefined) continue;
                  cleanHeaders[hk.toLowerCase()] = hv as string | string[];
                }

                resolve({
                  status: statusCode,
                  statusText: '',
                  headers: cleanHeaders,
                  data: Buffer.concat(chunks),
                  finalUrl: targetUrl,
                });
              }
            });
            h2Req.on('error', err => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                client?.close();
                reject(err);
              }
            });

            if (bodyBuf && bodyBuf.length > 0 && upperM !== 'GET' && upperM !== 'HEAD') {
              h2Req.write(bodyBuf);
            }
            h2Req.end();
          } catch (err) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              client?.close();
              reject(err);
            }
          }
        });

      const fetchProxyViaHttp1 = async (overrideIp = '') => {
        const parsed = new URL(url);
        return axios.request({
          url,
          method: String(method).toUpperCase(),
          headers: outgoingHeaders,
          data: bodyBuffer,
          responseType: 'arraybuffer',
          maxRedirects: redirect === 'manual' ? 0 : 8,
          validateStatus: () => true,
          timeout: 30000,
          httpsAgent: createIpScopedHttpsAgent(parsed.hostname, overrideIp),
        });
      };

      const parsedProxyUrl = new URL(url);
      const targetHostLower = parsedProxyUrl.hostname.toLowerCase();
      const cachedIpEntry = workingEdgeIpCache.get(targetHostLower);
      const cachedIp =
        cachedIpEntry && Date.now() - cachedIpEntry.at < EDGE_CACHE_TTL_MS
          ? cachedIpEntry.ip
          : '';
      const isKnownH2Host = isKnownH2OrCdnHost(url);

      let response: any;
      if (cachedIp) {
        try {
          response = isKnownH2Host
            ? await fetchProxyViaHttp2(url, method, outgoingHeaders, bodyBuffer, redirect, 8, cachedIp)
            : await fetchProxyViaHttp1(cachedIp);
        } catch {
          response = undefined;
        }
        if (
          !response ||
          response.status === 426 ||
          response.status === 428 ||
          response.status === 403 ||
          response.status === 429
        ) {
          workingEdgeIpCache.delete(targetHostLower);
          response = undefined;
        }
      }

      if (!response && isKnownH2Host) {
        try {
          response = await fetchProxyViaHttp2(url, method, outgoingHeaders, bodyBuffer, redirect);
        } catch {
          response = undefined;
        }
      }

      if (!response || response.status === 426 || response.status === 428) {
        try {
          const axiosRes = await fetchProxyViaHttp1();
          if (!response || (axiosRes.status !== 426 && axiosRes.status !== 428)) {
            response = axiosRes;
          }
        } catch {
          // Keep previous response if any
        }
        if (
          (!response || response.status === 426 || response.status === 428) &&
          !isKnownH2Host
        ) {
          try {
            const h2Fallback = await fetchProxyViaHttp2(url, method, outgoingHeaders, bodyBuffer, redirect);
            if (h2Fallback.status < 400 || !response) {
              response = h2Fallback;
            }
          } catch {
            // Continue to alternate edge IPs
          }
        }
      }

      if (
        !response ||
        response.status === 426 ||
        response.status === 428 ||
        (isKnownH2Host && (response.status === 403 || response.status === 429))
      ) {
        const altIps = await resolveAlternateEdgeIps(parsedProxyUrl.hostname);
        for (const ip of altIps.slice(0, 6)) {
          let candidate: any;
          try {
            candidate = await fetchProxyViaHttp1(ip);
          } catch {
            candidate = undefined;
          }
          if (!candidate || candidate.status === 426 || candidate.status === 428) {
            try {
              const h2Candidate = await fetchProxyViaHttp2(url, method, outgoingHeaders, bodyBuffer, redirect, 8, ip);
              if (h2Candidate.status < 400) {
                candidate = h2Candidate;
              }
            } catch {
              // Ignore
            }
          }
          if (candidate && candidate.status >= 200 && candidate.status < 400) {
            workingEdgeIpCache.set(targetHostLower, {at: Date.now(), ip});
            response = candidate;
            break;
          }
        }
      }

      if (!response) {
        response = await fetchProxyViaHttp1();
      }

      const upperMethod = String(method).toUpperCase();
      const rawBuf = Buffer.isBuffer(response.data)
        ? response.data
        : Buffer.from(response.data || []);
      const rawPreview = rawBuf.slice(0, 1024).toString('utf8');
      const isCfChallenge =
        response.status === 403 ||
        response.status === 429 ||
        response.status === 503 ||
        String(response.headers?.['cf-mitigated'] || '').includes('challenge') ||
        rawPreview.includes('<title>Just a moment...</title>') ||
        rawPreview.includes('Attention Required! | Cloudflare');

      if (upperMethod === 'GET' && isCfChallenge) {
        try {
          const aoRes = await axios.get(
            `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
            {timeout: 14000, validateStatus: () => true},
          );
          const contents = aoRes.data?.contents;
          const httpCode = Number(aoRes.data?.status?.http_code || 0);
          if (
            aoRes.status === 200 &&
            typeof contents === 'string' &&
            contents.length > 0 &&
            httpCode >= 200 &&
            httpCode < 400 &&
            !contents.includes('<title>Just a moment...</title>') &&
            !contents.includes('Attention Required! | Cloudflare')
          ) {
            res.json({
              status: httpCode,
              statusText: 'OK',
              url: aoRes.data?.status?.url || url,
              headers: {
                'content-type':
                  aoRes.data?.status?.content_type ||
                  'text/html; charset=utf-8',
              },
              bodyBase64: Buffer.from(contents, 'utf8').toString('base64'),
            });
            return;
          }
        } catch {
          // Continue to codetabs
        }

        try {
          const ctRes = await axios.get(
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
            {
              responseType: 'arraybuffer',
              timeout: 12000,
              validateStatus: () => true,
            },
          );
          if (ctRes.status >= 200 && ctRes.status < 400 && ctRes.data) {
            const buf = Buffer.isBuffer(ctRes.data)
              ? ctRes.data
              : Buffer.from(ctRes.data);
            const preview = buf.slice(0, 1024).toString('utf8');
            if (
              !preview.includes('<title>Just a moment...</title>') &&
              !preview.includes('Attention Required! | Cloudflare')
            ) {
              res.json({
                status: ctRes.status,
                statusText: 'OK',
                url,
                headers: {
                  'content-type':
                    String(ctRes.headers['content-type'] || '') ||
                    'text/html; charset=utf-8',
                },
                bodyBase64: buf.toString('base64'),
              });
              return;
            }
          }
        } catch {
          // Return original response
        }
      }

      const responseHeaders: Record<string, string> = {};
      for (const [key, val] of Object.entries(response.headers)) {
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

      res.json({
        status: response.status,
        statusText: response.statusText || '',
        url: finalUrl,
        headers: responseHeaders,
        bodyBase64: rawBuffer.toString('base64'),
      });
    } catch (error: any) {
      res.status(502).json({
        error: error?.message || 'Proxy request failed',
      });
    }
  };

  app.post('/api/proxy', handleApiProxy);
  app.post('/api/edge-proxy', handleApiProxy);

  app.get('/api/base-url', async (req, res) => {
    try {
      const providerValue = String(req.query.provider || '').trim();
      const map = await fetchModflixBaseUrls();
      if (!providerValue) {
        res.json(map);
        return;
      }
      const entry =
        map[providerValue] ||
        Object.entries(map).find(
          ([k]) => k.toLowerCase() === providerValue.toLowerCase(),
        )?.[1];
      res.json({
        provider: providerValue,
        url: entry?.url || '',
        name: entry?.name || providerValue,
      });
    } catch (error: any) {
      res.status(500).json({error: error?.message || 'Failed to resolve base URL'});
    }
  });

  app.post('/api/crypto/digest', (req, res) => {
    try {
      const {algorithm = 'SHA-256', data = '', encoding = 'hex'} = req.body || {};
      const normalizedAlgo = String(algorithm)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      const algoMap: Record<string, string> = {
        MD5: 'md5',
        SHA1: 'sha1',
        SHA256: 'sha256',
        SHA384: 'sha384',
        SHA512: 'sha512',
      };
      const nodeAlgo = algoMap[normalizedAlgo] || 'sha256';
      const digest = crypto
        .createHash(nodeAlgo)
        .update(String(data), 'utf8')
        .digest(encoding === 'base64' ? 'base64' : 'hex');
      res.json({digest});
    } catch (err: any) {
      res.status(400).json({error: err?.message || 'Crypto digest failed'});
    }
  });

  // Probe stream metadata (duration, codecs, multi-audio tracks, embedded subtitles)
  app.get('/api/probe-stream', async (req, res) => {
    try {
      const targetUrl = String(req.query.url || '').trim();
      const encodedHeaders = String(req.query.headers || '').trim();
      if (!targetUrl) {
        res.status(400).json({error: 'Missing url parameter'});
        return;
      }
      const customHeaders = parseEncodedHeaders(encodedHeaders);
      const info = await probeRemoteStream(targetUrl, customHeaders);
      res.json(info);
    } catch (err: any) {
      res.status(200).json({
        duration: 0,
        formatName: '',
        videoCodec: '',
        width: 0,
        height: 0,
        audioTracks: [],
        subtitleTracks: [],
        error: err?.message || 'Probe failed',
      });
    }
  });

  // Extract embedded MKV/MP4 subtitle track to WebVTT on the fly
  app.get('/api/subtitle-extract', (req, res) => {
    const targetUrl = String(req.query.url || '').trim();
    const encodedHeaders = String(req.query.headers || '').trim();
    const trackIndex = Math.max(0, parseInt(String(req.query.track || '0'), 10) || 0);
    const startSec = Math.max(0, parseFloat(String(req.query.start || '0')) || 0);

    if (!targetUrl) {
      res.status(400).send('Missing url');
      return;
    }

    const customHeaders = parseEncodedHeaders(encodedHeaders);
    const useLoopback = isKnownH2OrCdnHost(targetUrl);
    const inputUrl = useLoopback
      ? buildLoopbackStreamUrl(targetUrl, customHeaders)
      : targetUrl;
    const headerStr = useLoopback ? '' : buildFfmpegHeadersArg(customHeaders);

    const args: string[] = ['-v', 'error'];
    if (headerStr) {
      args.push('-headers', headerStr);
    }
    if (startSec > 0) {
      args.push('-ss', String(startSec));
    }
    args.push(
      '-i',
      inputUrl,
      '-map',
      `0:s:${trackIndex}`,
      '-f',
      'webvtt',
      'pipe:1',
    );

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    const ff = spawn('ffmpeg', args, {stdio: ['ignore', 'pipe', 'ignore']});
    ff.stdout.pipe(res);

    req.on('close', () => {
      ff.kill('SIGKILL');
    });
  });

  // Live FFmpeg Remux / Transcode Stream Endpoint for Browser Compatibility (MKV, EAC3, AC3, HEVC, Dual-Audio)
  app.get('/api/transcode-stream', async (req, res) => {
    const targetUrl = String(req.query.url || '').trim();
    const encodedHeaders = String(req.query.headers || '').trim();
    const startSec = Math.max(0, parseFloat(String(req.query.start || '0')) || 0);
    const audioIndex = Math.max(0, parseInt(String(req.query.audio || '0'), 10) || 0);
    const requestedMode = String(req.query.mode || 'auto').toLowerCase();

    if (!targetUrl) {
      res.status(400).send('Missing url parameter');
      return;
    }

    const customHeaders = parseEncodedHeaders(encodedHeaders);
    const useLoopback = isKnownH2OrCdnHost(targetUrl);
    const inputUrl = useLoopback
      ? buildLoopbackStreamUrl(targetUrl, customHeaders)
      : targetUrl;
    const headerStr = useLoopback ? '' : buildFfmpegHeadersArg(customHeaders);

    // Determine whether we can copy video (-c:v copy) or need H.264 software transcoding
    let useSoftwareVideoTranscode = requestedMode === 'sw' || requestedMode === 'transcode';
    if (requestedMode === 'auto') {
      try {
        const info = await probeRemoteStream(targetUrl, customHeaders);
        if (
          info.videoCodec &&
          info.videoCodec !== 'h264' &&
          info.videoCodec !== 'avc1'
        ) {
          // HEVC / 10-bit / MPEG4 etc. -> transcode to H.264 so all browsers play it smoothly
          useSoftwareVideoTranscode = true;
        }
      } catch {
        // Default to fast remux first
      }
    }

    const args: string[] = [
      '-v',
      'error',
      '-reconnect',
      '1',
      '-reconnect_streamed',
      '1',
      '-reconnect_delay_max',
      '5',
    ];

    if (headerStr) {
      args.push('-headers', headerStr);
    }

    if (startSec > 0) {
      args.push('-ss', String(startSec));
    }

    args.push('-i', inputUrl);

    // Map primary video and selected audio stream
    args.push('-map', '0:v:0', '-map', `0:a:${audioIndex}?`, '-sn', '-dn');

    if (useSoftwareVideoTranscode) {
      args.push(
        '-vf',
        "scale='min(1920,iw)':-2,format=yuv420p",
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-tune',
        'zerolatency',
        '-crf',
        '24',
        '-maxrate',
        '6M',
        '-bufsize',
        '12M',
      );
    } else {
      args.push('-c:v', 'copy');
    }

    // Always convert audio to browser-native 2-channel AAC so EAC3/AC3/DTS/5.1 MKVs have crystal-clear sound
    args.push(
      '-c:a',
      'aac',
      '-ac',
      '2',
      '-b:a',
      '192k',
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof+faststart',
      '-f',
      'mp4',
      'pipe:1',
    );

    res.status(200);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection', 'keep-alive');

    const ff = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    ff.stdout.pipe(res);

    ff.on('error', () => {
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.end();
      }
    });

    req.on('close', () => {
      ff.kill('SIGKILL');
    });
  });

  function getProxyOrigin(req: express.Request): string {
    const proto = String(
      req.headers['x-forwarded-proto'] || req.protocol || 'http',
    )
      .split(',')[0]
      .trim();
    const host = String(
      req.headers['x-forwarded-host'] || req.get('host') || '',
    ).trim();
    return host ? `${proto}://${host}` : '';
  }

  function openHttp2Stream(
    targetUrl: string,
    outgoingHeaders: Record<string, string>,
    method = 'GET',
    redirectsLeft = 5,
    overrideIp = '',
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let client: http2.ClientHttp2Session | undefined;
      let h2Req: http2.ClientHttp2Stream | undefined;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          h2Req?.destroy();
          client?.close();
          reject(new Error('HTTP/2 stream timeout'));
        }
      }, 20000);

      try {
        const parsed = new URL(targetUrl);
        const connectOpts: any = {
          rejectUnauthorized: false,
          ...(overrideIp
            ? {lookup: createHostScopedLookup(parsed.hostname, overrideIp)}
            : {}),
        };
        client = http2.connect(parsed.origin, connectOpts);

        client.on('error', err => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });

        const h2Headers: Record<string, string> = {
          ':method': method === 'HEAD' ? 'HEAD' : 'GET',
          ':scheme': parsed.protocol.replace(':', ''),
          ':authority': parsed.host,
          ':path': parsed.pathname + parsed.search,
        };

        for (const [k, v] of Object.entries(outgoingHeaders)) {
          const lower = k.toLowerCase();
          if (
            lower === 'host' ||
            lower === 'connection' ||
            lower === 'keep-alive' ||
            lower === 'transfer-encoding' ||
            lower === 'upgrade' ||
            lower === 'http2-settings'
          ) {
            continue;
          }
          h2Headers[lower] = String(v);
        }

        h2Req = client.request(h2Headers);

        h2Req.on('response', respHeaders => {
          if (settled) return;
          const statusCode = Number(respHeaders[':status'] || 200);

          if (
            statusCode >= 300 &&
            statusCode < 400 &&
            respHeaders['location'] &&
            redirectsLeft > 0
          ) {
            settled = true;
            clearTimeout(timer);
            h2Req?.destroy();
            client?.close();
            const redirectUrl = new URL(
              String(respHeaders['location']),
              targetUrl,
            ).toString();
            openHttp2Stream(
              redirectUrl,
              outgoingHeaders,
              method,
              redirectsLeft - 1,
              overrideIp,
            )
              .then(resolve)
              .catch(reject);
            return;
          }

          settled = true;
          clearTimeout(timer);

          const normalizedHeaders: Record<string, string> = {};
          for (const [hk, hv] of Object.entries(respHeaders)) {
            if (hk.startsWith(':') || hv === undefined) continue;
            normalizedHeaders[hk.toLowerCase()] = Array.isArray(hv)
              ? hv.join(', ')
              : String(hv);
          }

          resolve({
            protocol: 'h2',
            status: statusCode,
            headers: normalizedHeaders,
            finalUrl: targetUrl,
            stream: h2Req,
            destroy: () => {
              try {
                h2Req?.destroy();
              } catch {}
              try {
                client?.close();
              } catch {}
            },
          });
        });

        h2Req.on('error', err => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            try {
              client?.close();
            } catch {}
            reject(err);
          }
        });
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            client?.close();
          } catch {}
          reject(err);
        }
      }
    });
  }

  async function openHttp1Stream(
    targetUrl: string,
    outgoingHeaders: Record<string, string>,
    method = 'GET',
    overrideIp = '',
    proxyUrl = '',
  ) {
    let currentUrl = targetUrl;
    const currentHeaders: Record<string, string> = {...outgoingHeaders};
    const maxHops = 8;

    for (let hop = 0; hop <= maxHops; hop++) {
      const parsed = new URL(currentUrl);
      const agent = proxyUrl
        ? getSocksAgent(proxyUrl)
        : createIpScopedHttpsAgent(parsed.hostname, overrideIp);
      const upstream = await axios.request({
        url: currentUrl,
        method: method === 'HEAD' ? 'HEAD' : 'GET',
        headers: currentHeaders,
        responseType: 'stream',
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 30000,
        httpAgent: proxyUrl ? agent : undefined,
        httpsAgent: agent,
      });

      if (
        upstream.status >= 300 &&
        upstream.status < 400 &&
        upstream.headers?.location &&
        hop < maxHops
      ) {
        try {
          upstream.data?.destroy();
        } catch {}
        if (upstream.headers['set-cookie']) {
          const cookieKey =
            Object.keys(currentHeaders).find(
              k => k.toLowerCase() === 'cookie',
            ) || 'Cookie';
          currentHeaders[cookieKey] = mergeCookiesFromSetCookie(
            currentHeaders[cookieKey],
            upstream.headers['set-cookie'],
          );
        }
        currentUrl = new URL(
          String(upstream.headers.location),
          currentUrl,
        ).toString();
        continue;
      }

      const normalizedHeaders: Record<string, string> = {};
      for (const [hk, hv] of Object.entries(upstream.headers || {})) {
        if (hv === undefined) continue;
        normalizedHeaders[hk.toLowerCase()] = Array.isArray(hv)
          ? hv.join(', ')
          : String(hv);
      }

      return {
        protocol: 'h1',
        status: upstream.status,
        headers: normalizedHeaders,
        finalUrl: currentUrl,
        stream: upstream.data,
        destroy: () => {
          try {
            if (upstream.data && typeof upstream.data.destroy === 'function') {
              upstream.data.destroy();
            }
          } catch {}
        },
      };
    }
    throw new Error('Too many redirects');
  }

  function isRetryableStreamStatus(status: number, isH2Cdn: boolean): boolean {
    if (status === 426 || status === 427 || status === 428) return true;
    if (isH2Cdn && (status === 403 || status === 429)) return true;
    return false;
  }

  async function openStreamWithBypass(
    targetUrl: string,
    outgoingHeaders: Record<string, string>,
    method: string,
  ) {
    const parsed = new URL(targetUrl);
    const hostLower = parsed.hostname.toLowerCase();
    const isH2Cdn = isKnownH2OrCdnHost(targetUrl);
    const cachedIpEntry = workingEdgeIpCache.get(hostLower);
    const cachedIp =
      cachedIpEntry && Date.now() - cachedIpEntry.at < EDGE_CACHE_TTL_MS
        ? cachedIpEntry.ip
        : '';

    let lastResult: any = null;
    const tryCandidate = async (proto: 'h1' | 'h2', overrideIp: string) => {
      try {
        const resObj =
          proto === 'h2'
            ? await openHttp2Stream(targetUrl, outgoingHeaders, method, 5, overrideIp)
            : await openHttp1Stream(targetUrl, outgoingHeaders, method, overrideIp);
        if (resObj.status >= 200 && resObj.status < 400) {
          if (overrideIp) {
            workingEdgeIpCache.set(hostLower, {at: Date.now(), ip: overrideIp});
          }
          return resObj;
        }
        if (lastResult) lastResult.destroy();
        lastResult = resObj;
        return null;
      } catch {
        return null;
      }
    };

    if (cachedIp) {
      const hit =
        (await tryCandidate('h1', cachedIp)) ||
        (await tryCandidate('h2', cachedIp));
      if (hit) return hit;
      workingEdgeIpCache.delete(hostLower);
    }

    if (isH2Cdn) {
      const h2Hit = await tryCandidate('h2', '');
      if (h2Hit) return h2Hit;
      const h1Hit = await tryCandidate('h1', '');
      if (h1Hit) return h1Hit;
    } else {
      const h1Hit = await tryCandidate('h1', '');
      if (h1Hit) return h1Hit;
      if (!lastResult || lastResult.status === 426 || lastResult.status === 428) {
        const h2Hit = await tryCandidate('h2', '');
        if (h2Hit) return h2Hit;
      }
    }

    if (!lastResult || isRetryableStreamStatus(lastResult.status, isH2Cdn)) {
      const altIps = await resolveAlternateEdgeIps(parsed.hostname);
      for (const ip of altIps.slice(0, 10)) {
        const h1Alt = await tryCandidate('h1', ip);
        if (h1Alt) return h1Alt;
        const h2Alt = await tryCandidate('h2', ip);
        if (h2Alt) return h2Alt;
      }
    }

    if (
      ENV_STREAM_PROXY_URL &&
      (!lastResult || isRetryableStreamStatus(lastResult.status, isH2Cdn))
    ) {
      try {
        const resObj = await openHttp1Stream(
          targetUrl,
          outgoingHeaders,
          method,
          '',
          ENV_STREAM_PROXY_URL,
        );
        if (resObj.status >= 200 && resObj.status < 400) {
          return resObj;
        }
        if (lastResult) lastResult.destroy();
        lastResult = resObj;
      } catch {
        // Ignore optional proxy failure
      }
    }

    return lastResult;
  }

  // Direct Byte-Range & HLS Stream Proxy
  const handleLocalStreamProxy = async (req: express.Request, res: express.Response) => {
    try {
      const targetUrl = String(req.query.url || '').trim();
      const encodedHeaders = String(req.query.headers || '').trim();
      const isDownload = req.query.download === '1';

      if (!targetUrl) {
        res.status(400).send('Missing url query parameter');
        return;
      }

      const customHeaders = parseEncodedHeaders(encodedHeaders);

      const outgoingHeaders: Record<string, string> = {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: '*/*',
      };

      for (const [k, v] of Object.entries(customHeaders)) {
        const lower = k.toLowerCase();
        if (lower === 'host' || lower === 'connection') continue;
        outgoingHeaders[k] = v;
      }

      if (req.headers.range) {
        outgoingHeaders['Range'] = req.headers.range;
      }

      const method = req.method === 'HEAD' ? 'HEAD' : 'GET';
      const upstream = await openStreamWithBypass(targetUrl, outgoingHeaders, method);

      if (!upstream) {
        res.status(502).send('Failed to connect to upstream media server');
        return;
      }

      const finalUrl = upstream.finalUrl || targetUrl;
      const contentType = String(
        upstream.headers['content-type'] || '',
      ).toLowerCase();

      const lowerFinalPath = finalUrl.split('?')[0].toLowerCase();
      const lowerTargetPath = targetUrl.split('?')[0].toLowerCase();

      const isM3u8 =
        contentType.includes('mpegurl') ||
        contentType.includes('x-mpegurl') ||
        lowerFinalPath.endsWith('.m3u8') ||
        lowerTargetPath.endsWith('.m3u8');

      const isMpd =
        contentType.includes('dash+xml') ||
        lowerFinalPath.endsWith('.mpd') ||
        lowerTargetPath.endsWith('.mpd');

      const isTextSub =
        lowerFinalPath.endsWith('.vtt') ||
        lowerFinalPath.endsWith('.srt') ||
        lowerTargetPath.endsWith('.vtt') ||
        lowerTargetPath.endsWith('.srt') ||
        contentType.includes('subrip') ||
        contentType.includes('text/vtt');

      if (
        upstream.status >= 200 &&
        upstream.status < 300 &&
        !isDownload &&
        !isM3u8 &&
        !isMpd &&
        !isTextSub &&
        contentType.includes('text/html')
      ) {
        upstream.destroy();
        res
          .status(415)
          .send('Upstream returned an HTML webpage instead of a media stream');
        return;
      }

      if (
        isM3u8 &&
        upstream.status >= 200 &&
        upstream.status < 300 &&
        req.method !== 'HEAD'
      ) {
        const chunks: Buffer[] = [];
        for await (const chunk of upstream.stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        upstream.destroy();
        const rawText = Buffer.concat(chunks).toString('utf8');
        if (rawText.trimStart().startsWith('#EXTM3U')) {
          const rewritten = rewriteM3u8Playlist(
            rawText,
            finalUrl,
            encodedHeaders,
            getProxyOrigin(req),
          );
          res.status(upstream.status);
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.setHeader('Cache-Control', 'no-cache');
          res.send(rewritten);
          return;
        }
        res.status(upstream.status);
        if (upstream.headers['content-type']) {
          res.setHeader(
            'Content-Type',
            String(upstream.headers['content-type']),
          );
        }
        res.send(Buffer.concat(chunks));
        return;
      }

      res.status(upstream.status);
      const forwardHeaders = [
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
        'last-modified',
        'etag',
      ];
      for (const h of forwardHeaders) {
        const val = upstream.headers[h];
        if (val !== undefined) {
          res.setHeader(h, String(val));
        }
      }

      if (isDownload) {
        res.setHeader(
          'Content-Type',
          String(upstream.headers['content-type'] || 'application/octet-stream'),
        );
      } else if (isMpd) {
        res.setHeader('Content-Type', 'application/dash+xml');
      } else if (
        lowerFinalPath.endsWith('.vtt') ||
        lowerTargetPath.endsWith('.vtt') ||
        contentType.includes('text/vtt')
      ) {
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      } else if (
        lowerFinalPath.endsWith('.srt') ||
        lowerTargetPath.endsWith('.srt') ||
        contentType.includes('subrip')
      ) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      } else if (
        !contentType ||
        contentType.includes('octet-stream') ||
        contentType.includes('matroska') ||
        contentType.includes('mkv')
      ) {
        res.setHeader('Content-Type', 'video/mp4');
      } else if (upstream.headers['content-type']) {
        res.setHeader('Content-Type', String(upstream.headers['content-type']));
      }

      if (!res.getHeader('accept-ranges')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }

      if (req.method === 'HEAD') {
        upstream.destroy();
        res.end();
        return;
      }

      upstream.stream.on('end', () => {
        upstream.destroy();
      });

      upstream.stream.on('error', () => {
        upstream.destroy();
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      });

      res.on('close', () => {
        if (!res.writableEnded) {
          upstream.destroy();
        }
      });

      upstream.stream.pipe(res);
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(502).send(err?.message || 'Stream proxy error');
      }
    }
  };

  app.get('/api/stream-proxy', handleLocalStreamProxy);
  app.head('/api/stream-proxy', handleLocalStreamProxy);

  // GitHub Repository Creation & Push Endpoint for rahul882213 / Vega Web
  app.post('/api/github/push', async (req, res) => {
    try {
      const {
        token,
        owner = 'rahul882213',
        repoName = 'Vega-Web',
        description = 'Vega Web — Exact web browser version of the Vega streaming application',
        isPrivate = false,
      } = req.body || {};

      const cleanToken = String(token || process.env.GITHUB_TOKEN || '').trim();
      if (!cleanToken) {
        res.status(400).json({
          error:
            'GitHub Personal Access Token is required to create and push to your GitHub repository.',
        });
        return;
      }

      const sanitizedRepo =
        String(repoName || 'Vega-Web')
          .trim()
          .replace(/\s+/g, '-') || 'Vega-Web';

      const ghHeaders = {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Vega-Web-App',
      };

      // 1. Verify authenticated user & create repository if needed
      const userRes = await axios.get('https://api.github.com/user', {
        headers: ghHeaders,
        validateStatus: () => true,
      });

      if (userRes.status !== 200) {
        res.status(401).json({
          error: `GitHub authentication failed (${userRes.status}): ${
            userRes.data?.message || 'Invalid token'
          }`,
        });
        return;
      }

      const authedLogin: string = userRes.data?.login || owner;

      // Create repo under authenticated account
      const createRes = await axios.post(
        'https://api.github.com/user/repos',
        {
          name: sanitizedRepo,
          description,
          private: Boolean(isPrivate),
          auto_init: true,
        },
        {
          headers: ghHeaders,
          validateStatus: () => true,
        },
      );

      if (createRes.status !== 201 && createRes.status !== 422) {
        res.status(400).json({
          error: `Failed to create repository (${createRes.status}): ${
            createRes.data?.message || 'Unknown error'
          }`,
        });
        return;
      }

      // 2. Ensure repository has an initial commit on 'main'
      let refRes = await axios.get(
        `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/ref/heads/main`,
        {
          headers: ghHeaders,
          validateStatus: () => true,
        },
      );

      if (refRes.status !== 200) {
        const readmePath = path.join(__dirname, 'README.md');
        const readmeContent = fs.existsSync(readmePath)
          ? fs.readFileSync(readmePath, 'utf8')
          : `# ${sanitizedRepo}\n\n${description}\n`;

        const initRes = await axios.put(
          `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/contents/README.md`,
          {
            message: 'Initial commit: Initialize Vega Web repository',
            content: Buffer.from(readmeContent, 'utf8').toString('base64'),
            branch: 'main',
          },
          {
            headers: ghHeaders,
            validateStatus: () => true,
          },
        );

        if (initRes.status !== 201 && initRes.status !== 200) {
          res.status(400).json({
            error: `Failed to initialize repository (${initRes.status}): ${
              initRes.data?.message || 'Unknown error'
            }`,
          });
          return;
        }

        refRes = await axios.get(
          `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/ref/heads/main`,
          {
            headers: ghHeaders,
            validateStatus: () => true,
          },
        );
      }

      const latestCommitSha: string | undefined = refRes.data?.object?.sha;
      if (!latestCommitSha) {
        res.status(500).json({
          error: 'Could not resolve latest commit SHA on branch main',
        });
        return;
      }

      // 3. Collect all workspace source files
      const ignoredDirs = new Set([
        'node_modules',
        'dist',
        '.git',
        '.DS_Store',
        '.vega-ref',
      ]);

      const rawFiles: Array<{
        path: string;
        content: string;
      }> = [];

      function walkDir(currentDir: string, relBase = '') {
        const entries = fs.readdirSync(currentDir, {withFileTypes: true});
        for (const entry of entries) {
          if (ignoredDirs.has(entry.name)) continue;
          const relPath = relBase
            ? `${relBase}/${entry.name}`
            : entry.name;
          if (
            relPath === '.env' ||
            relPath === 'bun.lock' ||
            relPath === 'package-lock.json' ||
            relPath.startsWith('public/assets/aistudio') ||
            relPath.endsWith('.zip') ||
            relPath.endsWith('.jpg') ||
            relPath.endsWith('.png')
          ) {
            continue;
          }
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath, relPath);
          } else if (entry.isFile()) {
            const content = fs.readFileSync(fullPath, 'utf8');
            rawFiles.push({
              path: relPath,
              content,
            });
          }
        }
      }

      walkDir(__dirname);

      // 4. Create blobs for each file and build Git tree
      const treeItems: Array<{
        path: string;
        mode: '100644';
        type: 'blob';
        sha: string;
      }> = [];

      for (const file of rawFiles) {
        const blobRes = await axios.post(
          `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/blobs`,
          {
            content: Buffer.from(file.content, 'utf8').toString('base64'),
            encoding: 'base64',
          },
          {
            headers: ghHeaders,
            validateStatus: () => true,
          },
        );
        if (blobRes.status !== 201 || !blobRes.data?.sha) {
          res.status(500).json({
            error: `Failed to create blob for ${file.path} (${blobRes.status}): ${
              blobRes.data?.message || 'Unknown error'
            }`,
          });
          return;
        }
        treeItems.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blobRes.data.sha,
        });
      }

      const treeRes = await axios.post(
        `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/trees`,
        {
          tree: treeItems,
        },
        {
          headers: ghHeaders,
          validateStatus: () => true,
        },
      );

      if (treeRes.status !== 201 || !treeRes.data?.sha) {
        res.status(500).json({
          error: `Failed to create Git tree (${treeRes.status}): ${
            treeRes.data?.message || 'Unknown error'
          }`,
        });
        return;
      }

      // 5. Create commit
      const commitRes = await axios.post(
        `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/commits`,
        {
          message:
            'feat: Vega Web application with Vega Browser Player & Provider Runtime',
          tree: treeRes.data.sha,
          parents: [latestCommitSha],
        },
        {
          headers: ghHeaders,
          validateStatus: () => true,
        },
      );

      if (commitRes.status !== 201 || !commitRes.data?.sha) {
        res.status(500).json({
          error: `Failed to create Git commit (${commitRes.status}): ${
            commitRes.data?.message || 'Unknown error'
          }`,
        });
        return;
      }

      // 6. Update branch reference
      const updateRefRes = await axios.patch(
        `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/refs/heads/main`,
        {
          sha: commitRes.data.sha,
          force: true,
        },
        {
          headers: ghHeaders,
          validateStatus: () => true,
        },
      );

      if (updateRefRes.status !== 200) {
        res.status(500).json({
          error: `Failed to update main branch reference (${updateRefRes.status}): ${
            updateRefRes.data?.message || 'Unknown error'
          }`,
        });
        return;
      }

      // 7. Also publish built dist/ to gh-pages branch and enable GitHub Pages
      let pagesUrl = `https://${authedLogin}.github.io/${sanitizedRepo}/`;
      let pagesEnabled = false;
      try {
        const distDir = path.join(__dirname, 'dist');
        if (fs.existsSync(distDir)) {
          const distFiles: Array<{path: string; contentBase64: string}> = [];
          const walkDist = (dir: string, rel = '') => {
            const entries = fs.readdirSync(dir, {withFileTypes: true});
            for (const entry of entries) {
              const relPath = rel ? `${rel}/${entry.name}` : entry.name;
              if (relPath.startsWith('assets/aistudio')) continue;
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                walkDist(fullPath, relPath);
              } else if (entry.isFile()) {
                const buf = fs.readFileSync(fullPath);
                distFiles.push({
                  path: relPath,
                  contentBase64: buf.toString('base64'),
                });
              }
            }
          };
          walkDist(distDir);

          // Add .nojekyll and 404.html (copy of index.html for SPA routing)
          distFiles.push({
            path: '.nojekyll',
            contentBase64: Buffer.from('', 'utf8').toString('base64'),
          });
          const indexHtmlPath = path.join(distDir, 'index.html');
          if (fs.existsSync(indexHtmlPath)) {
            distFiles.push({
              path: '404.html',
              contentBase64: fs.readFileSync(indexHtmlPath).toString('base64'),
            });
          }

          const ghPagesTreeItems: Array<{
            path: string;
            mode: '100644';
            type: 'blob';
            sha: string;
          }> = [];

          for (const df of distFiles) {
            const bRes = await axios.post(
              `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/blobs`,
              {
                content: df.contentBase64,
                encoding: 'base64',
              },
              {headers: ghHeaders, validateStatus: () => true},
            );
            if (bRes.status === 201 && bRes.data?.sha) {
              ghPagesTreeItems.push({
                path: df.path,
                mode: '100644',
                type: 'blob',
                sha: bRes.data.sha,
              });
            }
          }

          if (ghPagesTreeItems.length > 0) {
            const gpTreeRes = await axios.post(
              `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/trees`,
              {tree: ghPagesTreeItems},
              {headers: ghHeaders, validateStatus: () => true},
            );

            if (gpTreeRes.status === 201 && gpTreeRes.data?.sha) {
              const gpCommitRes = await axios.post(
                `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/commits`,
                {
                  message: 'deploy: Vega Web static build for GitHub Pages',
                  tree: gpTreeRes.data.sha,
                  parents: [commitRes.data.sha],
                },
                {headers: ghHeaders, validateStatus: () => true},
              );

              if (gpCommitRes.status === 201 && gpCommitRes.data?.sha) {
                const gpRefCheck = await axios.get(
                  `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/ref/heads/gh-pages`,
                  {headers: ghHeaders, validateStatus: () => true},
                );
                if (gpRefCheck.status === 200) {
                  await axios.patch(
                    `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/refs/heads/gh-pages`,
                    {sha: gpCommitRes.data.sha, force: true},
                    {headers: ghHeaders, validateStatus: () => true},
                  );
                } else {
                  await axios.post(
                    `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/git/refs`,
                    {
                      ref: 'refs/heads/gh-pages',
                      sha: gpCommitRes.data.sha,
                    },
                    {headers: ghHeaders, validateStatus: () => true},
                  );
                }

                // Enable or update GitHub Pages on gh-pages branch
                let pagesRes = await axios.post(
                  `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/pages`,
                  {
                    source: {
                      branch: 'gh-pages',
                      path: '/',
                    },
                  },
                  {headers: ghHeaders, validateStatus: () => true},
                );
                if (pagesRes.status === 409 || pagesRes.status === 422) {
                  await axios.put(
                    `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/pages`,
                    {
                      source: {
                        branch: 'gh-pages',
                        path: '/',
                      },
                    },
                    {headers: ghHeaders, validateStatus: () => true},
                  );
                  pagesRes = await axios.get(
                    `https://api.github.com/repos/${authedLogin}/${sanitizedRepo}/pages`,
                    {headers: ghHeaders, validateStatus: () => true},
                  );
                }
                if (
                  pagesRes.status === 201 ||
                  pagesRes.status === 204 ||
                  pagesRes.status === 200
                ) {
                  pagesEnabled = true;
                  if (pagesRes.data?.html_url) {
                    pagesUrl = pagesRes.data.html_url;
                  }
                }
              }
            }
          }
        }
      } catch (gpErr) {
        console.warn('GitHub Pages auto-setup warning:', gpErr);
      }

      const htmlUrl = `https://github.com/${authedLogin}/${sanitizedRepo}`;
      res.json({
        success: true,
        repoUrl: htmlUrl,
        pagesUrl,
        pagesEnabled,
        owner: authedLogin,
        repo: sanitizedRepo,
        filesPushed: treeItems.length,
        commitSha: commitRes.data.sha,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Failed to push repository to GitHub',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vega Web server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
