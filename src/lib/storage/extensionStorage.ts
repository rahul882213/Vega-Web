import {mainStorage, cacheStorage} from './StorageService';

export interface ProviderSource {
  author: string;
  url: string;
  isDefault?: boolean;
  isPrivate?: boolean;
}

export interface ProviderExtension {
  value: string;
  display_name: string;
  version: string;
  icon?: string;
  disabled: boolean;
  type: string;
  category?: string;
  installed: boolean;
  source: ProviderSource;
  path?: string;
  installedAt?: number;
  lastUpdated?: number;
}

export interface ProviderModule {
  value: string;
  sourceAuthor: string;
  version: string;
  modules: {
    posts?: string;
    meta?: string;
    stream?: string;
    catalog?: string;
    episodes?: string;
    settings?: string;
  };
  cachedAt: number;
}

export enum ExtensionKeys {
  INSTALLED_PROVIDERS = 'installedProviders',
  AVAILABLE_PROVIDERS = 'availableProviders',
  PROVIDER_MODULES = 'providerModules',
  MANIFEST_CACHE = 'manifestCache',
  LAST_MANIFEST_FETCH = 'lastManifestFetch',
  PROVIDER_SOURCES = 'providerSources',
  DEFAULT_SOURCE_SEEDED = 'defaultZendaCrossSeeded',
}

export const ZENDA_CROSS_DEFAULT_SOURCE: ProviderSource = {
  author: 'Zenda-Cross',
  url: 'https://raw.githubusercontent.com/Zenda-Cross/vega-providers/refs/heads/main',
  isDefault: true,
  isPrivate: false,
};

export const isSameSource = (
  a?: ProviderSource,
  b?: ProviderSource,
): boolean => {
  if (!a || !b) {
    return false;
  }
  return a.author.toLowerCase() === b.author.toLowerCase();
};

export class ExtensionStorage {
  constructor() {
    this.ensureDefaultZendaCrossSource();
  }

  private ensureDefaultZendaCrossSource(): void {
    if (!mainStorage.getBool(ExtensionKeys.DEFAULT_SOURCE_SEEDED, false)) {
      mainStorage.setBool(ExtensionKeys.DEFAULT_SOURCE_SEEDED, true);
      const existing =
        mainStorage.getArray<ProviderSource>(ExtensionKeys.PROVIDER_SOURCES) ||
        [];
      if (existing.length === 0) {
        mainStorage.setArray(ExtensionKeys.PROVIDER_SOURCES, [
          ZENDA_CROSS_DEFAULT_SOURCE,
        ]);
      }
    }
  }

  getProviderSources(): ProviderSource[] {
    return (
      mainStorage.getArray<ProviderSource>(ExtensionKeys.PROVIDER_SOURCES) || []
    );
  }

  setProviderSources(sources: ProviderSource[]): void {
    mainStorage.setArray(ExtensionKeys.PROVIDER_SOURCES, sources);
  }

  addProviderSource(
    author: string,
    url: string,
    isPrivate: boolean = false,
  ): void {
    const trimmedAuthor = author.trim();
    const trimmedUrl = url.trim().replace(/\/+$/, '');
    if (!trimmedAuthor || !trimmedUrl) {
      return;
    }

    const sources = this.getProviderSources();
    const existingIndex = sources.findIndex(
      s => s.author.toLowerCase() === trimmedAuthor.toLowerCase(),
    );
    const shouldBeDefault = sources.length === 0;

    if (existingIndex >= 0) {
      sources[existingIndex] = {
        ...sources[existingIndex],
        author: trimmedAuthor,
        url: trimmedUrl,
        isPrivate: isPrivate ?? sources[existingIndex].isPrivate,
      };
    } else {
      sources.push({
        author: trimmedAuthor,
        url: trimmedUrl,
        isDefault: shouldBeDefault,
        isPrivate,
      });
    }

    this.setProviderSources(sources);
  }

  removeProviderSource(author: string): void {
    let sources = this.getProviderSources().filter(
      s => s.author.toLowerCase() !== author.toLowerCase(),
    );
    if (sources.length > 0 && !sources.some(s => s.isDefault)) {
      sources[0].isDefault = true;
    }
    this.setProviderSources(sources);
    mainStorage.delete(`${ExtensionKeys.AVAILABLE_PROVIDERS}_${author}`);
    cacheStorage.delete(`${ExtensionKeys.MANIFEST_CACHE}_${author}`);
  }

  setDefaultProviderSource(author: string): void {
    const sources = this.getProviderSources().map(source => ({
      ...source,
      isDefault: source.author.toLowerCase() === author.toLowerCase(),
    }));
    this.setProviderSources(sources);
  }

  getDefaultProviderSource(): ProviderSource | undefined {
    const sources = this.getProviderSources();
    return sources.find(s => s.isDefault) || sources[0];
  }

  getInstalledProviders(): ProviderExtension[] {
    return (
      mainStorage.getArray<ProviderExtension>(
        ExtensionKeys.INSTALLED_PROVIDERS,
      ) || []
    );
  }

  setInstalledProviders(providers: ProviderExtension[]): void {
    mainStorage.setArray(ExtensionKeys.INSTALLED_PROVIDERS, providers);
  }

  getAvailableProviders(sourceAuthor?: string): ProviderExtension[] {
    const targetAuthor =
      sourceAuthor || this.getDefaultProviderSource()?.author;
    if (!targetAuthor) {
      return [];
    }
    return (
      mainStorage.getArray<ProviderExtension>(
        `${ExtensionKeys.AVAILABLE_PROVIDERS}_${targetAuthor}`,
      ) || []
    );
  }

  setAvailableProviders(
    sourceAuthor: string,
    providers: ProviderExtension[],
  ): void {
    if (!sourceAuthor) {
      return;
    }
    mainStorage.setArray(
      `${ExtensionKeys.AVAILABLE_PROVIDERS}_${sourceAuthor}`,
      providers,
    );
  }

  installProvider(provider: ProviderExtension): void {
    const installed = this.getInstalledProviders();
    const existingIndex = installed.findIndex(
      p =>
        p.value === provider.value && isSameSource(p.source, provider.source),
    );

    const updatedProvider: ProviderExtension = {
      ...provider,
      installed: true,
      installedAt:
        existingIndex >= 0 ? installed[existingIndex].installedAt : Date.now(),
      lastUpdated: Date.now(),
    };

    if (existingIndex >= 0) {
      installed[existingIndex] = updatedProvider;
    } else {
      installed.push(updatedProvider);
    }

    this.setInstalledProviders(installed);
  }

  uninstallProvider(providerValue: string, sourceAuthor?: string): void {
    const installed = this.getInstalledProviders().filter(p => {
      if (p.value !== providerValue) {
        return true;
      }
      if (!sourceAuthor) {
        return false;
      }
      return p.source?.author?.toLowerCase() !== sourceAuthor.toLowerCase();
    });
    this.setInstalledProviders(installed);
    this.removeProviderModules(providerValue, sourceAuthor);
  }

  updateProviderVersion(
    providerValue: string,
    newVersion: string,
    sourceAuthor?: string,
  ): void {
    const installed = this.getInstalledProviders();
    const provider = installed.find(
      p =>
        p.value === providerValue &&
        (!sourceAuthor ||
          p.source?.author?.toLowerCase() === sourceAuthor.toLowerCase()),
    );

    if (provider) {
      provider.version = newVersion;
      provider.lastUpdated = Date.now();
      this.setInstalledProviders(installed);
    }
  }

  isProviderInstalled(providerValue: string, sourceAuthor?: string): boolean {
    const installed = this.getInstalledProviders();
    return installed.some(
      p =>
        p.value === providerValue &&
        p.installed &&
        (!sourceAuthor ||
          p.source?.author?.toLowerCase() === sourceAuthor.toLowerCase()),
    );
  }

  getProviderModules(
    providerValue: string,
    sourceAuthor?: string,
  ): ProviderModule | undefined {
    const allModules = this.getAllProviderModules();
    const candidates = allModules.filter(m => m.value === providerValue);
    if (candidates.length === 0) {
      return undefined;
    }
    if (sourceAuthor) {
      return candidates.find(
        m => m.sourceAuthor?.toLowerCase() === sourceAuthor.toLowerCase(),
      );
    }
    return candidates.sort((a, b) => b.cachedAt - a.cachedAt)[0];
  }

  getAllProviderModules(): ProviderModule[] {
    return (
      cacheStorage.getArray<ProviderModule>(ExtensionKeys.PROVIDER_MODULES) ||
      []
    );
  }

  cacheProviderModules(moduleData: ProviderModule): void {
    const allModules = this.getAllProviderModules();
    const existingIndex = allModules.findIndex(
      m =>
        m.value === moduleData.value &&
        m.sourceAuthor?.toLowerCase() ===
          moduleData.sourceAuthor?.toLowerCase(),
    );

    if (existingIndex >= 0) {
      allModules[existingIndex] = moduleData;
    } else {
      allModules.push(moduleData);
    }

    cacheStorage.setArray(ExtensionKeys.PROVIDER_MODULES, allModules);
  }

  removeProviderModules(providerValue: string, sourceAuthor?: string): void {
    const allModules = this.getAllProviderModules().filter(m => {
      if (m.value !== providerValue) {
        return true;
      }
      if (!sourceAuthor) {
        return false;
      }
      return m.sourceAuthor?.toLowerCase() !== sourceAuthor.toLowerCase();
    });
    cacheStorage.setArray(ExtensionKeys.PROVIDER_MODULES, allModules);
  }

  getManifestCache(sourceAuthor?: string): ProviderExtension[] {
    const targetAuthor =
      sourceAuthor || this.getDefaultProviderSource()?.author;
    if (!targetAuthor) {
      return [];
    }
    return (
      cacheStorage.getArray<ProviderExtension>(
        `${ExtensionKeys.MANIFEST_CACHE}_${targetAuthor}`,
      ) || []
    );
  }

  setManifestCache(
    sourceAuthor: string,
    manifest: ProviderExtension[],
  ): void {
    if (!sourceAuthor) {
      return;
    }
    cacheStorage.setArray(
      `${ExtensionKeys.MANIFEST_CACHE}_${sourceAuthor}`,
      manifest,
    );
    cacheStorage.setNumber(
      `${ExtensionKeys.LAST_MANIFEST_FETCH}_${sourceAuthor}`,
      Date.now(),
    );
  }

  getLastManifestFetch(sourceAuthor?: string): number {
    const targetAuthor =
      sourceAuthor || this.getDefaultProviderSource()?.author;
    if (!targetAuthor) {
      return 0;
    }
    return (
      cacheStorage.getNumber(
        `${ExtensionKeys.LAST_MANIFEST_FETCH}_${targetAuthor}`,
      ) || 0
    );
  }

  shouldRefreshManifest(sourceAuthor?: string): boolean {
    const lastFetch = this.getLastManifestFetch(sourceAuthor);
    const oneHour = 60 * 60 * 1000;
    return Date.now() - lastFetch > oneHour;
  }

  getProvidersNeedingUpdate(sourceAuthor?: string): ProviderExtension[] {
    const installed = this.getInstalledProviders();
    const sources = this.getProviderSources();
    const availablePool: ProviderExtension[] = [];

    if (sourceAuthor) {
      availablePool.push(...this.getAvailableProviders(sourceAuthor));
    } else {
      sources.forEach(source => {
        availablePool.push(...this.getAvailableProviders(source.author));
      });
    }

    return installed.filter(installedProvider => {
      if (
        sourceAuthor &&
        installedProvider.source?.author?.toLowerCase() !==
          sourceAuthor.toLowerCase()
      ) {
        return false;
      }
      const availableProvider = availablePool.find(
        p =>
          p.value === installedProvider.value &&
          isSameSource(p.source, installedProvider.source),
      );
      if (!availableProvider) {
        return false;
      }
      return availableProvider.version !== installedProvider.version;
    });
  }

  clearAll(): void {
    const sources = this.getProviderSources();
    sources.forEach(source => {
      mainStorage.delete(`${ExtensionKeys.AVAILABLE_PROVIDERS}_${source.author}`);
      cacheStorage.delete(`${ExtensionKeys.MANIFEST_CACHE}_${source.author}`);
      cacheStorage.delete(
        `${ExtensionKeys.LAST_MANIFEST_FETCH}_${source.author}`,
      );
    });
    mainStorage.delete(ExtensionKeys.INSTALLED_PROVIDERS);
    mainStorage.delete(ExtensionKeys.PROVIDER_SOURCES);
    cacheStorage.delete(ExtensionKeys.PROVIDER_MODULES);
  }
}

export const extensionStorage = new ExtensionStorage();
