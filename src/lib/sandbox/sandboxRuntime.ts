import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as cheerio from 'cheerio';
import {getBaseUrl} from '../providers/getBaseUrl';
import {
  providerKvStorage,
  providerCookieStorage,
  extensionStorage,
} from '../storage';
import type {
  Catalog,
  EpisodeLink,
  Info,
  OpenWebViewOptions,
  OpenWebViewResult,
  Post,
  ProviderActionResult,
  ProviderContext,
  ProviderKvStore,
  ProviderSettingItem,
  Stream,
} from '../providers/types';

export const COMMON_HEADERS: Record<string, string> = {
  'sec-ch-ua':
    '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

const __awaiter = function (
  thisArg: any,
  _arguments: any,
  P: any,
  generator: any,
) {
  function adopt(value: any) {
    return value instanceof P
      ? value
      : new P(function (resolve: any) {
          resolve(value);
        });
  }
  return new (P || (P = Promise))(function (resolve: any, reject: any) {
    function fulfilled(value: any) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value: any) {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result: any) {
      result.done
        ? resolve(result.value)
        : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = window.atob(base64 || '');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeUtf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return uint8ToBase64(bytes);
}

function decodeBase64ToUtf8(base64: string): string {
  const bytes = base64ToUint8(base64);
  return new TextDecoder().decode(bytes);
}

function getCookieJar(author: string): Record<string, Record<string, string>> {
  const key = `jar_${(author || 'default').toLowerCase()}`;
  return providerCookieStorage.getObject<Record<string, Record<string, string>>>(
    key,
  ) || {};
}

function saveCookieJar(
  author: string,
  jar: Record<string, Record<string, string>>,
): void {
  const key = `jar_${(author || 'default').toLowerCase()}`;
  providerCookieStorage.setObject(key, jar);
}

export function getCookiesForUrl(author: string, targetUrl: string): string {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    const jar = getCookieJar(author);
    const matched: Record<string, string> = {};
    for (const [domain, cookies] of Object.entries(jar)) {
      if (host === domain || host.endsWith(`.${domain}`)) {
        Object.assign(matched, cookies);
      }
    }
    return Object.entries(matched)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  } catch {
    return '';
  }
}

export function storeSetCookieForUrl(
  author: string,
  targetUrl: string,
  setCookieRaw: string,
): void {
  if (!setCookieRaw) return;
  try {
    const parsed = new URL(targetUrl);
    const defaultDomain = parsed.hostname.toLowerCase();
    const jar = getCookieJar(author);
    const lines = setCookieRaw.split(/\r?\n/);
    for (const line of lines) {
      const parts = line.split(';').map(p => p.trim());
      if (!parts[0]) continue;
      const eqIdx = parts[0].indexOf('=');
      if (eqIdx <= 0) continue;
      const name = parts[0].slice(0, eqIdx).trim();
      const val = parts[0].slice(eqIdx + 1).trim();
      let domain = defaultDomain;
      for (let i = 1; i < parts.length; i++) {
        const [attr, attrVal] = parts[i].split('=');
        if (attr && attr.toLowerCase() === 'domain' && attrVal) {
          domain = attrVal.trim().replace(/^\.+/, '').toLowerCase();
        }
      }
      if (!jar[domain]) jar[domain] = {};
      jar[domain][name] = val;
    }
    saveCookieJar(author, jar);
  } catch {
    // Ignore invalid URL
  }
}

export async function proxyFetch(
  author: string,
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Uint8Array | null;
    redirect?: 'follow' | 'manual';
    signal?: AbortSignal;
  },
): Promise<{
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  bodyBytes: Uint8Array;
  bodyText: string;
}> {
  const method = (init?.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {...(init?.headers || {})};

  const storedCookie = getCookiesForUrl(author, url);
  if (storedCookie) {
    const existingKey = Object.keys(headers).find(
      k => k.toLowerCase() === 'cookie',
    );
    if (existingKey) {
      headers[existingKey] = `${headers[existingKey]}; ${storedCookie}`;
    } else {
      headers['Cookie'] = storedCookie;
    }
  }

  let bodyBase64: string | undefined;
  if (init?.body instanceof Uint8Array) {
    bodyBase64 = uint8ToBase64(init.body);
  } else if (typeof init?.body === 'string' && init.body.length > 0) {
    bodyBase64 = encodeUtf8ToBase64(init.body);
  }

  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      url,
      method,
      headers,
      bodyBase64,
      redirect: init?.redirect || 'follow',
    }),
    signal: init?.signal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `Proxy HTTP ${res.status}`);
  }

  const data = await res.json();
  const responseHeaders: Record<string, string> = data.headers || {};
  if (responseHeaders['set-cookie']) {
    storeSetCookieForUrl(
      author,
      data.url || url,
      responseHeaders['set-cookie'],
    );
  }

  const bodyBytes = base64ToUint8(data.bodyBase64 || '');
  const bodyText = decodeBase64ToUtf8(data.bodyBase64 || '');

  return {
    status: data.status,
    statusText: data.statusText || '',
    url: data.url || url,
    headers: responseHeaders,
    bodyBytes,
    bodyText,
  };
}

function createProviderFetchFunction(author: string) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => {
          headers[k] = v;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => {
          headers[k] = v;
        });
      } else {
        Object.entries(init.headers).forEach(([k, v]) => {
          if (v !== undefined) headers[k] = String(v);
        });
      }
    }

    let bodyPayload: string | Uint8Array | null = null;
    if (typeof init?.body === 'string') {
      bodyPayload = init.body;
    } else if (init?.body instanceof URLSearchParams) {
      bodyPayload = init.body.toString();
    } else if (init?.body instanceof ArrayBuffer) {
      bodyPayload = new Uint8Array(init.body);
    } else if (ArrayBuffer.isView(init?.body)) {
      bodyPayload = new Uint8Array(
        init.body.buffer,
        init.body.byteOffset,
        init.body.byteLength,
      );
    }

    const proxied = await proxyFetch(author, rawUrl, {
      method: init?.method || 'GET',
      headers,
      body: bodyPayload,
      redirect: init?.redirect === 'manual' ? 'manual' : 'follow',
      signal: init?.signal || undefined,
    });

    const respHeaders = new Headers();
    Object.entries(proxied.headers).forEach(([k, v]) => {
      try {
        respHeaders.set(k, v);
      } catch {
        // Ignore forbidden response header names in browser Headers
      }
    });

    const response = new Response(proxied.bodyBytes as unknown as BodyInit, {
      status: proxied.status || 200,
      statusText: proxied.statusText,
      headers: respHeaders,
    });

    Object.defineProperty(response, 'url', {
      value: proxied.url,
      writable: false,
    });

    return response;
  };
}

function createProviderAxios(author: string) {
  const customAdapter = async (
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse> => {
    const fullUrl = axios.getUri(config);
    const headers: Record<string, string> = {};

    if (config.headers) {
      const raw =
        typeof (config.headers as AxiosHeaders).toJSON === 'function'
          ? (config.headers as AxiosHeaders).toJSON()
          : config.headers;
      Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
        if (v !== undefined && v !== null && typeof v !== 'object') {
          headers[k] = String(v);
        }
      });
    }

    let body: string | Uint8Array | null = null;
    if (config.data !== undefined && config.data !== null) {
      if (typeof config.data === 'string') {
        body = config.data;
      } else if (config.data instanceof URLSearchParams) {
        body = config.data.toString();
      } else if (config.data instanceof Uint8Array) {
        body = config.data;
      } else if (typeof config.data === 'object') {
        body = JSON.stringify(config.data);
        if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
          headers['Content-Type'] = 'application/json';
        }
      } else {
        body = String(config.data);
      }
    }

    const proxied = await proxyFetch(author, fullUrl, {
      method: (config.method || 'get').toUpperCase(),
      headers,
      body,
      redirect: config.maxRedirects === 0 ? 'manual' : 'follow',
      signal: config.signal as AbortSignal | undefined,
    });

    let data: unknown = proxied.bodyText;
    if (config.responseType === 'arraybuffer') {
      data = proxied.bodyBytes.buffer.slice(
        proxied.bodyBytes.byteOffset,
        proxied.bodyBytes.byteOffset + proxied.bodyBytes.byteLength,
      );
    } else if (
      config.responseType === 'json' ||
      config.responseType === undefined
    ) {
      const trimmed = proxied.bodyText.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          data = JSON.parse(trimmed);
        } catch {
          data = proxied.bodyText;
        }
      }
    }

    const response: AxiosResponse = {
      data,
      status: proxied.status,
      statusText: proxied.statusText,
      headers: proxied.headers,
      config,
      request: {
        responseURL: proxied.url,
      },
    };

    const validateStatus =
      config.validateStatus === undefined
        ? (s: number) => s >= 200 && s < 300
        : config.validateStatus;

    if (validateStatus && !validateStatus(proxied.status)) {
      const err = new Error(
        `Request failed with status code ${proxied.status}`,
      ) as AxiosError;
      err.config = config;
      err.response = response;
      err.isAxiosError = true;
      throw err;
    }

    return response;
  };

  const instance = axios.create({
    adapter: customAdapter,
  });

  // Ensure axios.create inside providers also inherits customAdapter
  const originalCreate = axios.create.bind(axios);
  (instance as any).create = (cfg?: any) =>
    originalCreate({
      ...cfg,
      adapter: customAdapter,
    });
  (instance as any).CancelToken = axios.CancelToken;
  (instance as any).isCancel = axios.isCancel;
  (instance as any).isAxiosError = axios.isAxiosError;

  return instance as unknown as typeof axios;
}

function createScopedKvStore(
  author: string,
  providerValue: string,
): ProviderKvStore {
  const prefix = `${(author || 'default').toLowerCase()}:${providerValue}:`;
  const fullKey = (k: string) => `${prefix}${k}`;

  return {
    get: async <T = any>(key: string, defaultValue?: T) =>
      providerKvStorage.getAny(fullKey(key), defaultValue) as T | undefined,
    set: async (key: string, val: any) =>
      providerKvStorage.setAny(fullKey(key), val),
    remove: async (key: string) => providerKvStorage.delete(fullKey(key)),
    hasKey: async (key: string) => providerKvStorage.hasKey(fullKey(key)),
    getString: async key => providerKvStorage.getString(fullKey(key)),
    setString: async (key, val) =>
      providerKvStorage.setString(fullKey(key), String(val)),
    getBool: async (key, defaultVal) =>
      providerKvStorage.getBool(fullKey(key), defaultVal),
    setBool: async (key, val) =>
      providerKvStorage.setBool(fullKey(key), Boolean(val)),
    getNumber: async key => providerKvStorage.getNumber(fullKey(key)),
    setNumber: async (key, val) =>
      providerKvStorage.setNumber(fullKey(key), Number(val)),
    getObject: async <T = any>(key: string) =>
      providerKvStorage.getObject<T>(fullKey(key)),
    setObject: async <T = any>(key: string, val: T) =>
      providerKvStorage.setObject(fullKey(key), val),
    getArray: async <T = any>(key: string) =>
      providerKvStorage.getArray<T>(fullKey(key)),
    setArray: async <T = any>(key: string, val: T[]) =>
      providerKvStorage.setArray(fullKey(key), val),
    delete: async key => providerKvStorage.delete(fullKey(key)),
    contains: async key => providerKvStorage.contains(fullKey(key)),
    getKeys: async () => {
      const all = await providerKvStorage.getKeys();
      return all
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));
    },
    clearAll: async () => {
      const all = await providerKvStorage.getKeys();
      all
        .filter(k => k.startsWith(prefix))
        .forEach(k => providerKvStorage.delete(k));
    },
  };
}

const cryptoShim: ProviderContext['Crypto'] = {
  CryptoDigestAlgorithm: {
    MD5: 'MD5',
    SHA1: 'SHA-1',
    SHA256: 'SHA-256',
    SHA384: 'SHA-384',
    SHA512: 'SHA-512',
  },
  CryptoEncoding: {
    HEX: 'hex',
    BASE64: 'base64',
  },
  digestStringAsync: async (algorithm, data, options) => {
    const encoding =
      options?.encoding?.toLowerCase() === 'base64' ? 'base64' : 'hex';
    const res = await fetch('/api/crypto/digest', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({algorithm, data, encoding}),
    });
    if (!res.ok) {
      throw new Error('Failed to compute crypto digest');
    }
    const json = await res.json();
    return json.digest;
  },
  getRandomBytesAsync: async byteCount => {
    const count = Math.max(0, Math.min(65536, Math.floor(byteCount)));
    const arr = new Uint8Array(count);
    window.crypto.getRandomValues(arr);
    return arr;
  },
};

export function createProviderContext(
  providerValue: string,
  sourceAuthor?: string,
): ProviderContext {
  const author =
    sourceAuthor ||
    extensionStorage.getDefaultProviderSource()?.author ||
    'default';

  const providerAxios = createProviderAxios(author);
  const kvStore = createScopedKvStore(author, providerValue);

  return {
    axios: providerAxios,
    cheerio,
    Crypto: cryptoShim,
    commonHeaders: COMMON_HEADERS,
    getBaseUrl,
    getCookies: async (url: string) => getCookiesForUrl(author, url),
    openWebView: async (
      url: string,
      options?: OpenWebViewOptions,
    ): Promise<OpenWebViewResult> => {
      const proxied = await proxyFetch(author, url, {
        method: 'GET',
        headers: options?.headers,
      });
      const cookieHeader = getCookiesForUrl(author, proxied.url || url);
      const cookieMap: Record<string, string> = {};
      cookieHeader.split(';').forEach(part => {
        const [k, v] = part.split('=').map(s => s.trim());
        if (k && v !== undefined) cookieMap[k] = v;
      });
      return {
        cookies: cookieHeader,
        cookie: cookieHeader,
        cookieMap,
        cookieHeader,
        html: proxied.bodyText,
        url: proxied.url || url,
        userAgent: COMMON_HEADERS['User-Agent'],
      };
    },
    kvStore,
  };
}

export function executeProviderModuleCode(
  code: string,
  providerValue: string,
  sourceAuthor?: string,
): Record<string, any> {
  const author =
    sourceAuthor ||
    extensionStorage.getDefaultProviderSource()?.author ||
    'default';
  const exports: Record<string, any> = {};
  const module = {exports};
  const customFetch = createProviderFetchFunction(author);

  const requireShim = (id: string) => {
    if (id === 'axios') return createProviderAxios(author);
    if (id === 'cheerio') return cheerio;
    if (id === 'crypto' || id === 'expo-crypto') return cryptoShim;
    throw new Error(`Module "${id}" is not available in Vega provider runtime`);
  };

  const providerGlobal = {
    fetch: customFetch,
    btoa: (s: string) => window.btoa(s),
    atob: (s: string) => window.atob(s),
    URL,
    URLSearchParams,
    Headers,
    Request,
    Response,
    TextEncoder,
    TextDecoder,
    AbortController,
  };

  const factory = new Function(
    'exports',
    'module',
    'require',
    'console',
    'Promise',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'fetch',
    '__awaiter',
    'providerGlobal',
    `"use strict";\n${code}\n`,
  );

  factory(
    exports,
    module,
    requireShim,
    console,
    Promise,
    setTimeout.bind(window),
    clearTimeout.bind(window),
    setInterval.bind(window),
    clearInterval.bind(window),
    customFetch,
    __awaiter,
    providerGlobal,
  );

  return module.exports;
}

export async function runProviderCatalog(
  code: string,
  providerValue: string,
  sourceAuthor?: string,
): Promise<{catalog: Catalog[]; genres: Catalog[]}> {
  const mod = executeProviderModuleCode(code, providerValue, sourceAuthor);
  const providerContext = createProviderContext(providerValue, sourceAuthor);

  let catalog: Catalog[] = [];
  let genres: Catalog[] = [];

  if (Array.isArray(mod.catalog)) {
    catalog = mod.catalog;
  } else if (typeof mod.catalog === 'function') {
    const res = await mod.catalog({providerValue, providerContext});
    if (Array.isArray(res)) catalog = res;
  }

  if (Array.isArray(mod.genres)) {
    genres = mod.genres;
  } else if (typeof mod.genres === 'function') {
    const res = await mod.genres({providerValue, providerContext});
    if (Array.isArray(res)) genres = res;
  }

  return {catalog, genres};
}

export async function runProviderPosts(
  code: string,
  params: {
    filter: string;
    page: number;
    providerValue: string;
    signal?: AbortSignal;
    sourceAuthor?: string;
  },
): Promise<Post[]> {
  const mod = executeProviderModuleCode(
    code,
    params.providerValue,
    params.sourceAuthor,
  );
  if (typeof mod.getPosts !== 'function') {
    throw new Error(`getPosts not found in ${params.providerValue}`);
  }
  const providerContext = createProviderContext(
    params.providerValue,
    params.sourceAuthor,
  );
  const res = await mod.getPosts({
    filter: params.filter,
    page: params.page,
    providerValue: params.providerValue,
    signal: params.signal || new AbortController().signal,
    providerContext,
  });
  return Array.isArray(res) ? res : [];
}

export async function runProviderSearchPosts(
  code: string,
  params: {
    searchQuery: string;
    page: number;
    providerValue: string;
    signal?: AbortSignal;
    sourceAuthor?: string;
  },
): Promise<Post[]> {
  const mod = executeProviderModuleCode(
    code,
    params.providerValue,
    params.sourceAuthor,
  );
  if (typeof mod.getSearchPosts !== 'function') {
    throw new Error(`getSearchPosts not found in ${params.providerValue}`);
  }
  const providerContext = createProviderContext(
    params.providerValue,
    params.sourceAuthor,
  );
  const res = await mod.getSearchPosts({
    searchQuery: params.searchQuery,
    page: params.page,
    providerValue: params.providerValue,
    signal: params.signal || new AbortController().signal,
    providerContext,
  });
  return Array.isArray(res) ? res : [];
}

export async function runProviderMeta(
  code: string,
  params: {
    link: string;
    provider: string;
    signal?: AbortSignal;
    sourceAuthor?: string;
  },
): Promise<Info> {
  const mod = executeProviderModuleCode(
    code,
    params.provider,
    params.sourceAuthor,
  );
  if (typeof mod.getMeta !== 'function') {
    throw new Error(`getMeta not found in ${params.provider}`);
  }
  const providerContext = createProviderContext(
    params.provider,
    params.sourceAuthor,
  );
  return await mod.getMeta({
    link: params.link,
    provider: params.provider,
    signal: params.signal || new AbortController().signal,
    providerContext,
  });
}

export async function runProviderEpisodes(
  code: string,
  params: {
    url: string;
    providerValue: string;
    signal?: AbortSignal;
    sourceAuthor?: string;
  },
): Promise<EpisodeLink[]> {
  const mod = executeProviderModuleCode(
    code,
    params.providerValue,
    params.sourceAuthor,
  );
  if (typeof mod.getEpisodes !== 'function') {
    throw new Error(`getEpisodes not found in ${params.providerValue}`);
  }
  const providerContext = createProviderContext(
    params.providerValue,
    params.sourceAuthor,
  );
  const res = await mod.getEpisodes({
    url: params.url,
    signal: params.signal || new AbortController().signal,
    providerContext,
  });
  return Array.isArray(res) ? res : [];
}

export async function runProviderStream(
  code: string,
  params: {
    link: string;
    type: string;
    providerValue: string;
    isDownload?: boolean;
    signal?: AbortSignal;
    sourceAuthor?: string;
  },
): Promise<Stream[]> {
  const mod = executeProviderModuleCode(
    code,
    params.providerValue,
    params.sourceAuthor,
  );
  if (typeof mod.getStream !== 'function') {
    throw new Error(`getStream not found in ${params.providerValue}`);
  }
  const providerContext = createProviderContext(
    params.providerValue,
    params.sourceAuthor,
  );
  const res = await mod.getStream({
    link: params.link,
    type: params.type,
    isDownload: Boolean(params.isDownload),
    signal: params.signal || new AbortController().signal,
    providerContext,
  });
  return Array.isArray(res) ? res : [];
}

export async function runProviderSettingsSchema(
  code: string,
  params: {
    providerValue: string;
    signal?: AbortSignal;
    sourceAuthor?: string;
  },
): Promise<ProviderSettingItem[]> {
  const mod = executeProviderModuleCode(
    code,
    params.providerValue,
    params.sourceAuthor,
  );
  if (typeof mod.getSettingsSchema !== 'function') {
    return [];
  }
  const providerContext = createProviderContext(
    params.providerValue,
    params.sourceAuthor,
  );
  const res = await mod.getSettingsSchema({
    signal: params.signal || new AbortController().signal,
    providerContext,
  });
  return Array.isArray(res) ? res : [];
}

export async function runProviderSettingsAction(
  code: string,
  params: {
    key: string;
    providerValue: string;
    signal?: AbortSignal;
    sourceAuthor?: string;
  },
): Promise<ProviderActionResult> {
  const mod = executeProviderModuleCode(
    code,
    params.providerValue,
    params.sourceAuthor,
  );
  if (typeof mod.onSettingsAction !== 'function') {
    return {};
  }
  const providerContext = createProviderContext(
    params.providerValue,
    params.sourceAuthor,
  );
  const res = await mod.onSettingsAction({
    key: params.key,
    signal: params.signal || new AbortController().signal,
    providerContext,
  });
  return res || {};
}
