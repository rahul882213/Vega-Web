import {AxiosStatic} from 'axios';
import * as Cheerio from 'cheerio';

export interface Post {
  title: string;
  link: string;
  image: string;
  provider?: string;
}

export type TextTracks = {
  title: string;
  language: string;
  type: 'application/x-subrip' | 'application/ttml+xml' | 'text/vtt';
  uri: string;
}[];

export interface SkipInterval {
  type?: string;
  title?: string;
  startTime?: number;
  endTime?: number;
  from?: number;
  to?: number;
}

export interface Stream {
  server: string;
  link: string;
  type: string;
  quality?: '360' | '480' | '720' | '1080' | '2160' | string;
  subtitles?: TextTracks;
  headers?: any;
  tags?: string[];
  skip?: SkipInterval[];
}

export interface EpisodeLink {
  title: string;
  link: string;
  description?: string;
  image?: string;
  skip?: SkipInterval[];
}

export interface Link {
  title: string;
  episodesLink?: string;
  directLinks?: {
    title: string;
    link: string;
    type?: 'movie' | 'series';
    description?: string;
    image?: string;
    skip?: SkipInterval[];
  }[];
  quality?: string;
}

export interface Info {
  title: string;
  image: string;
  synopsis: string;
  imdbId: string;
  type: string;
  tags?: string[];
  cast?: string[];
  rating?: string;
  linkList: Link[];
  poster?: string;
  logo?: string;
  tmdbId?: number;
  populateMeta?: boolean;
  quickDownload?: boolean;
  webUrl?: string;
}

export interface Catalog {
  title: string;
  filter: string;
}

export interface ProviderToggleSetting {
  key: string;
  type: 'toggle';
  label: string;
  description?: string;
  defaultValue?: boolean;
}

export interface ProviderTextSetting {
  key: string;
  type: 'text';
  label: string;
  description?: string;
  placeholder?: string;
  secret?: boolean;
  defaultValue?: string;
}

export interface ProviderSelectSetting {
  key: string;
  type: 'select';
  label: string;
  description?: string;
  options: {label: string; value: string}[];
  defaultValue?: string;
}

export interface ProviderMultiSelectSetting {
  key: string;
  type: 'multiselect';
  label: string;
  description?: string;
  options: {label: string; value: string}[];
  defaultValue?: string[];
}

export interface ProviderActionSetting {
  key: string;
  type: 'action';
  label: string;
  description?: string;
  buttonLabel?: string;
}

export type ProviderSettingItem =
  | ProviderToggleSetting
  | ProviderTextSetting
  | ProviderSelectSetting
  | ProviderMultiSelectSetting
  | ProviderActionSetting;

export interface ProviderActionResult {
  message?: string;
  refresh?: boolean;
}

export interface ProviderKvStore {
  get: <T = any>(key: string, defaultValue?: T) => Promise<T | undefined>;
  set: (key: string, value: any) => Promise<void>;
  remove: (key: string) => Promise<void>;
  hasKey: (key: string) => Promise<boolean>;
  getString: (key: string) => Promise<string | undefined>;
  setString: (key: string, value: string) => Promise<void>;
  getBool: (key: string, defaultValue?: boolean) => Promise<boolean>;
  setBool: (key: string, value: boolean) => Promise<void>;
  getNumber: (key: string) => Promise<number | undefined>;
  setNumber: (key: string, value: number) => Promise<void>;
  getObject: <T = any>(key: string) => Promise<T | undefined>;
  setObject: <T = any>(key: string, value: T) => Promise<void>;
  getArray: <T = any>(key: string) => Promise<T[] | undefined>;
  setArray: <T = any>(key: string, value: T[]) => Promise<void>;
  delete: (key: string) => Promise<void>;
  contains: (key: string) => Promise<boolean>;
  getKeys: () => Promise<string[]>;
  clearAll: () => Promise<void>;
}

export interface OpenWebViewOptions {
  headers?: Record<string, string>;
  timeout?: number;
  waitForSelector?: string;
  waitForCookie?: string;
  evaluateJs?: string;
  title?: string;
  description?: string;
  force?: boolean;
}

export interface OpenWebViewResult {
  cookies: string;
  cookie?: string;
  cookieMap?: Record<string, string>;
  cookieHeader: string;
  html: string;
  url: string;
  userAgent: string;
  evalResult?: string;
}

export type ProviderContext = {
  axios: AxiosStatic;
  getBaseUrl: (providerValue: string) => Promise<string>;
  commonHeaders: Record<string, string>;
  Crypto: {
    CryptoDigestAlgorithm: {
      MD5: string;
      SHA1: string;
      SHA256: string;
      SHA384: string;
      SHA512: string;
    };
    CryptoEncoding: {
      HEX: string;
      BASE64: string;
    };
    digestStringAsync: (
      algorithm: string,
      data: string,
      options?: {encoding?: string},
    ) => Promise<string>;
    getRandomBytesAsync: (byteCount: number) => Promise<Uint8Array>;
  };
  cheerio: typeof Cheerio;
  openWebView: (
    url: string,
    options?: OpenWebViewOptions,
  ) => Promise<OpenWebViewResult>;
  getCookies: (url: string) => Promise<string>;
  kvStore: ProviderKvStore;
};
