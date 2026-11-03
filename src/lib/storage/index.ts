export {
  StorageService,
  mainStorage,
  cacheStorage,
  providerKvStorage,
  providerCookieStorage,
  clearAllMMKVStorage,
  createZustandStorage,
} from './StorageService';

export {
  SettingsStorage,
  settingsStorage,
  BUFFER_LIMITS,
  MAX_DOWNLOAD_CONNECTIONS,
  MIN_DOWNLOAD_CONNECTIONS,
  SEEK_INTERVAL_OPTIONS,
  PLAYBACK_SPEEDS,
  PLAYBACK_SPEED_MIN,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_STEP,
  PLAYER_RESIZE_MODES,
} from './SettingsStorage';
export type {
  SettingsKeys,
  PlayerResizeMode,
  VerificationWindowPolicy,
} from './SettingsStorage';

export {
  WatchListStorage,
  watchListStorage,
  DEFAULT_COLLECTION,
  DEFAULT_COLLECTION_ID,
  getItemCollectionIds,
  createCollectionId,
} from './WatchListStorage';
export type {
  WatchListKeys,
  WatchListItem,
  LibraryCollection,
} from './WatchListStorage';

export {CacheStorage, cacheStorageService} from './CacheStorage';

export {DownloadsStorage, downloadsStorage} from './DownloadsStorage';
export type {DownloadsKeys, DownloadPayload} from './DownloadsStorage';

export {
  ExtensionStorage,
  extensionStorage,
  ZENDA_CROSS_DEFAULT_SOURCE,
  isSameSource,
} from './extensionStorage';
export type {
  ExtensionKeys,
  ProviderExtension,
  ProviderModule,
  ProviderSource,
} from './extensionStorage';
