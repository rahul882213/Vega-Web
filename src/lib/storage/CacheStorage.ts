import {cacheStorage} from './StorageService';

export class CacheStorage {
  setString(key: string, value: string): void {
    cacheStorage.setString(key, value);
  }

  getString(key: string): string | undefined {
    return cacheStorage.getString(key);
  }

  setBool(key: string, value: boolean): void {
    cacheStorage.setBool(key, value);
  }

  getBool(key: string): boolean | undefined {
    return cacheStorage.getBool(key, undefined);
  }

  setObject<T>(key: string, value: T): void {
    cacheStorage.setObject(key, value);
  }

  getObject<T>(key: string): T | undefined {
    return cacheStorage.getObject<T>(key);
  }

  delete(key: string): void {
    cacheStorage.delete(key);
  }

  contains(key: string): boolean {
    return cacheStorage.contains(key);
  }

  clearAll(): void {
    cacheStorage.clearAll();
  }
}

export const cacheStorageService = new CacheStorage();
