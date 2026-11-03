import type {StateStorage} from 'zustand/middleware';

export interface IStorageService {
  getRevision?(key: string): number;
  getAny(key: string, defaultValue?: any): any;
  setAny(key: string, value: any): void;
  getString(key: string): string | undefined;
  setString(key: string, value: string): void;
  getBool(key: string, defaultValue?: boolean): boolean;
  setBool(key: string, value: boolean): void;
  getNumber(key: string): number | undefined;
  setNumber(key: string, value: number): void;
  getObject<T>(key: string): T | undefined;
  setObject<T>(key: string, value: T): void;
  getArray<T>(key: string): T[] | undefined;
  setArray<T>(key: string, value: T[]): void;
  delete(key: string): void;
  contains(key: string): boolean;
  hasKey(key: string): boolean;
  clearAll(): void;
  getKeys(): Promise<string[]>;
}

interface StoredEnvelope {
  t: 's' | 'b' | 'n';
  v: string | boolean | number;
}

export class StorageService implements IStorageService {
  private readonly prefix: string;
  private revision = 0;
  private clearedAt = 0;
  private readonly keyRevisions = new Map<string, number>();
  private readonly memoryStore = new Map<string, StoredEnvelope>();

  constructor(instanceId?: string) {
    this.prefix = instanceId ? `vega_mmkv_${instanceId}::` : 'vega_mmkv_main::';
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  getRevision(key: string): number {
    return this.keyRevisions.get(key) ?? this.clearedAt;
  }

  private didWrite(key: string): void {
    this.keyRevisions.set(key, ++this.revision);
  }

  private readEnvelope(key: string): StoredEnvelope | undefined {
    const fk = this.fullKey(key);
    const inMem = this.memoryStore.get(fk);
    if (inMem !== undefined) {
      return inMem;
    }
    try {
      const raw = window.localStorage.getItem(fk);
      if (raw === null) return undefined;
      try {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed.t === 's' || parsed.t === 'b' || parsed.t === 'n')
        ) {
          this.memoryStore.set(fk, parsed as StoredEnvelope);
          return parsed as StoredEnvelope;
        }
      } catch {
        // Fallback if stored as raw string
      }
      const fallback: StoredEnvelope = {t: 's', v: raw};
      this.memoryStore.set(fk, fallback);
      return fallback;
    } catch {
      return undefined;
    }
  }

  private writeEnvelope(key: string, env: StoredEnvelope): void {
    const fk = this.fullKey(key);
    this.memoryStore.set(fk, env);
    this.didWrite(key);
    try {
      window.localStorage.setItem(fk, JSON.stringify(env));
    } catch (e) {
      console.warn(`LocalStorage quota reached for key ${key}; kept in memory:`, e);
    }
  }

  getAny(key: string, defaultValue?: any): any {
    const env = this.readEnvelope(key);
    if (!env) return defaultValue;
    if (env.t === 'b' || env.t === 'n') {
      return env.v;
    }
    if (typeof env.v === 'string') {
      const trimmed = env.v.trim();
      if (
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))
      ) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return env.v;
        }
      }
      return env.v;
    }
    return env.v;
  }

  setAny(key: string, value: any): void {
    if (value === undefined || value === null) {
      this.delete(key);
      return;
    }
    if (typeof value === 'boolean') {
      this.setBool(key, value);
    } else if (typeof value === 'number') {
      this.setNumber(key, value);
    } else if (typeof value === 'object') {
      this.setObject(key, value);
    } else {
      this.setString(key, String(value));
    }
  }

  getString(key: string): string | undefined {
    const env = this.readEnvelope(key);
    if (!env) return undefined;
    return typeof env.v === 'string' ? env.v : String(env.v);
  }

  setString(key: string, value: string): void {
    this.writeEnvelope(key, {t: 's', v: value});
  }

  getBool(key: string, defaultValue?: boolean): boolean {
    const env = this.readEnvelope(key);
    if (!env || typeof env.v !== 'boolean') {
      return defaultValue ?? false;
    }
    return env.v;
  }

  setBool(key: string, value: boolean): void {
    this.writeEnvelope(key, {t: 'b', v: Boolean(value)});
  }

  getNumber(key: string): number | undefined {
    const env = this.readEnvelope(key);
    if (!env || typeof env.v !== 'number') return undefined;
    return env.v;
  }

  setNumber(key: string, value: number): void {
    this.writeEnvelope(key, {t: 'n', v: value});
  }

  getObject<T>(key: string): T | undefined {
    const json = this.getString(key);
    if (!json) return undefined;
    try {
      return JSON.parse(json) as T;
    } catch (e) {
      console.error(`Failed to parse stored object for key ${key}:`, e);
      return undefined;
    }
  }

  setObject<T>(key: string, value: T): void {
    this.setString(key, JSON.stringify(value));
  }

  getArray<T>(key: string): T[] | undefined {
    return this.getObject<T[]>(key);
  }

  setArray<T>(key: string, value: T[]): void {
    this.setObject(key, value);
  }

  delete(key: string): void {
    const fk = this.fullKey(key);
    this.memoryStore.delete(fk);
    try {
      window.localStorage.removeItem(fk);
    } catch {
      // Ignore
    }
    this.didWrite(key);
  }

  contains(key: string): boolean {
    return this.hasKey(key);
  }

  hasKey(key: string): boolean {
    const fk = this.fullKey(key);
    if (this.memoryStore.has(fk)) return true;
    try {
      return window.localStorage.getItem(fk) !== null;
    } catch {
      return false;
    }
  }

  clearAll(): void {
    this.memoryStore.clear();
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach(k => window.localStorage.removeItem(k));
    } catch {
      // Ignore
    }
    this.keyRevisions.clear();
    this.clearedAt = ++this.revision;
  }

  async getKeys(): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keys.push(k.slice(this.prefix.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  }
}

export const mainStorage: IStorageService = new StorageService();
export const cacheStorage: IStorageService = new StorageService('cache');
export const providerKvStorage: IStorageService = new StorageService(
  'provider_kv',
);
export const providerCookieStorage: IStorageService = new StorageService(
  'provider_cookies',
);

export const clearAllMMKVStorage = (): void => {
  cacheStorage.clearAll();
  mainStorage.clearAll();
  providerKvStorage.clearAll();
  providerCookieStorage.clearAll();
};

export const createZustandStorage = (
  storage: IStorageService = mainStorage,
): StateStorage => ({
  getItem: name => storage.getString(name) ?? null,
  setItem: (name, value) => storage.setString(name, value),
  removeItem: name => storage.delete(name),
});
