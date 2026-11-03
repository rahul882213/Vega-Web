import {
  extensionStorage,
  ProviderExtension,
  ProviderModule,
  ProviderSource,
} from '../storage/extensionStorage';
import {sourceTokenStorage} from '../storage/sourceTokenStorage';
import {validateProviderModule} from './providerVersion';
import {proxyFetch} from '../sandbox/sandboxRuntime';

export interface ManifestProvider {
  value: string;
  display_name: string;
  version: string;
  icon?: string;
  disabled?: boolean;
  type?: string;
  category?: string;
  path?: string;
}

const SAFE_PROVIDER_SEGMENT = /^[A-Za-z0-9._-]+$/;

export const isValidProviderPath = (rawPath: unknown): rawPath is string => {
  if (typeof rawPath !== 'string') {
    return false;
  }
  const trimmed = rawPath.trim();
  if (
    !trimmed ||
    trimmed.startsWith('/') ||
    trimmed.endsWith('/') ||
    trimmed.includes('\\')
  ) {
    return false;
  }
  const segments = trimmed.split('/');
  return segments.every(
    seg =>
      seg.length > 0 &&
      seg !== '.' &&
      seg !== '..' &&
      SAFE_PROVIDER_SEGMENT.test(seg),
  );
};

export class ExtensionManager {
  private static instance: ExtensionManager;

  private activeTestCount = 0;
  private testAbortController: AbortController | null = null;

  static getInstance(): ExtensionManager {
    if (!ExtensionManager.instance) {
      ExtensionManager.instance = new ExtensionManager();
    }
    return ExtensionManager.instance;
  }

  beginDiagnosticTest(): AbortSignal {
    this.activeTestCount++;
    if (!this.testAbortController) {
      this.testAbortController = new AbortController();
    }
    return this.testAbortController.signal;
  }

  endDiagnosticTest(): void {
    this.activeTestCount = Math.max(0, this.activeTestCount - 1);
    if (this.activeTestCount === 0) {
      this.testAbortController = null;
    }
  }

  cancelDiagnosticTest(): void {
    this.testAbortController?.abort();
  }

  isTestRunning(): boolean {
    return this.activeTestCount > 0;
  }

  private async getRequestHeaders(
    source?: ProviderSource,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      'Cache-Control': 'no-cache',
    };
    if (source?.isPrivate && source.author) {
      const token = await sourceTokenStorage.getToken(source.author);
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
    return headers;
  }

  createBaseSource(author: string): ProviderSource {
    const trimmed = author.trim();
    if (!trimmed) {
      return {author: '', url: ''};
    }

    if (/^https?:\/\//i.test(trimmed)) {
      const cleanInputUrl = trimmed
        .replace(/\/manifest\.json$/i, '')
        .replace(/\/+$/, '');

      try {
        const parsed = new URL(cleanInputUrl);
        const host = parsed.hostname.toLowerCase();
        const parts = parsed.pathname.split('/').filter(Boolean);

        if (host === 'github.com' && parts.length >= 2) {
          const user = parts[0];
          const repo = parts[1].replace(/\.git$/i, '');
          const branch =
            (parts[2] === 'tree' || parts[2] === 'blob') && parts[3]
              ? parts[3]
              : 'main';
          return {
            author: user,
            url: `https://raw.githubusercontent.com/${user}/${repo}/refs/heads/${branch}`,
          };
        }

        if (host === 'raw.githubusercontent.com' && parts.length >= 2) {
          const user = parts[0];
          return {
            author: user,
            url: cleanInputUrl,
          };
        }

        if (host === 'codeberg.org' && parts.length >= 2) {
          const user = parts[0];
          const repo = parts[1].replace(/\.git$/i, '');
          if (parts[2] === 'raw' && parts[3] === 'branch' && parts[4]) {
            return {author: `${user}@cb`, url: cleanInputUrl};
          }
          const branch =
            (parts[2] === 'src' || parts[2] === 'branch') && parts[3]
              ? parts[3]
              : 'main';
          return {
            author: `${user}@cb`,
            url: `https://codeberg.org/${user}/${repo}/raw/branch/${branch}`,
          };
        }

        if (host === 'gitlab.com' && parts.length >= 2) {
          const user = parts[0];
          const repo = parts[1].replace(/\.git$/i, '');
          return {
            author: `${user}@gl`,
            url: `https://gitlab.com/${user}/${repo}/-/raw/main`,
          };
        }

        const label = parts[0] ? `${host}/${parts[0]}` : host;
        return {
          author: label,
          url: cleanInputUrl,
        };
      } catch {
        return {
          author: trimmed,
          url: cleanInputUrl,
        };
      }
    }

    const match = trimmed.match(/^(.+?)(?:@(cb|bb|gl|gh))?$/i);
    const username = match ? match[1].trim() : trimmed;
    const platform = match && match[2] ? match[2].toLowerCase() : 'gh';

    let url = `https://raw.githubusercontent.com/${username}/vega-providers/refs/heads/main`;
    if (platform === 'cb') {
      url = `https://codeberg.org/${username}/vega-providers/raw/branch/main`;
    } else if (platform === 'bb') {
      url = `https://bitbucket.org/${username}/vega-providers/raw/main`;
    } else if (platform === 'gl') {
      url = `https://gitlab.com/${username}/vega-providers/-/raw/main`;
    }

    return {
      author: trimmed,
      url,
    };
  }

  getManifestUrl(baseUrl: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/manifest.json`;
  }

  getProviderBaseUrl(baseUrl: string, path?: string): string {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    if (isValidProviderPath(path)) {
      return `${cleanBase}/${path.trim()}`;
    }
    return `${cleanBase}/dist`;
  }

  async fetchManifest(
    sourceInput?: ProviderSource,
    force = false,
  ): Promise<ProviderExtension[]> {
    const source = sourceInput || extensionStorage.getDefaultProviderSource();
    if (!source || !source.author || !source.url) {
      return [];
    }

    try {
      if (!force && !extensionStorage.shouldRefreshManifest(source.author)) {
        const cached = extensionStorage.getManifestCache(source.author);
        if (cached.length > 0) {
          return cached;
        }
      }

      const manifestUrl = this.getManifestUrl(source.url);
      const headers = await this.getRequestHeaders(source);
      const proxied = await proxyFetch(source.author, manifestUrl, {
        method: 'GET',
        headers,
      });

      if (proxied.status < 200 || proxied.status >= 300) {
        throw new Error(`HTTP ${proxied.status}: Failed to fetch manifest`);
      }

      const parsed = JSON.parse(proxied.bodyText);
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid manifest format: expected an array');
      }

      const manifestData: ManifestProvider[] = parsed;
      const providers: ProviderExtension[] = manifestData
        .filter(item => {
          if (!item || typeof item !== 'object') return false;
          if (!isValidProviderPath(item.value) || item.value.includes('/')) {
            return false;
          }
          if (item.path !== undefined && !isValidProviderPath(item.path)) {
            return false;
          }
          return true;
        })
        .map(item => ({
          value: item.value.trim(),
          display_name: item.display_name,
          version: item.version,
          icon: item.icon || '',
          disabled: item.disabled || false,
          type: item.type || 'global',
          category: item.category || '',
          path: item.path?.trim(),
          source: {
            author: source.author,
            url: source.url,
            isPrivate: source.isPrivate,
          },
          installed: extensionStorage.isProviderInstalled(
            item.value.trim(),
            source.author,
          ),
        }));

      extensionStorage.setManifestCache(source.author, providers);
      extensionStorage.setAvailableProviders(source.author, providers);

      return providers;
    } catch (error) {
      console.error('Failed to fetch provider manifest:', error);
      const cached = extensionStorage.getManifestCache(source.author);
      if (cached.length > 0) {
        return cached;
      }
      throw error;
    }
  }

  async downloadProviderModules(
    provider: ProviderExtension,
    signal?: AbortSignal,
  ): Promise<ProviderModule> {
    if (!provider?.source?.url || !provider?.source?.author) {
      throw new Error('Provider source is missing');
    }
    if (!isValidProviderPath(provider.value) || provider.value.includes('/')) {
      throw new Error(`Invalid provider identifier: ${provider?.value}`);
    }

    const requiredFiles = ['posts', 'meta', 'stream', 'catalog'] as const;
    const optionalFiles = ['episodes', 'settings'] as const;
    const allFiles = [...requiredFiles, ...optionalFiles] as const;

    const modules: ProviderModule['modules'] = {};
    const downloadPromises = allFiles.map(async fileName => {
      try {
        const basePath = this.getProviderBaseUrl(
          provider.source.url,
          provider.path,
        );
        const fileUrl = isValidProviderPath(provider.path)
          ? `${basePath}/${fileName}.js`
          : `${basePath}/${provider.value}/${fileName}.js`;

        const headers = await this.getRequestHeaders(provider.source);
        const response = await proxyFetch(provider.source.author, fileUrl, {
          method: 'GET',
          headers,
          signal,
        });

        if (response.status >= 200 && response.status < 300 && response.bodyText) {
          modules[fileName] = response.bodyText;
        } else if (
          !optionalFiles.includes(fileName as (typeof optionalFiles)[number])
        ) {
          throw new Error(
            `HTTP ${response.status} downloading ${fileName}.js for ${provider.value}`,
          );
        }
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        if (!optionalFiles.includes(fileName as (typeof optionalFiles)[number])) {
          throw error;
        }
      }
    });

    await Promise.all(downloadPromises);

    for (const file of requiredFiles) {
      const check = validateProviderModule(modules[file], file);
      if (!check.valid) {
        throw new Error(
          `${provider.display_name || provider.value} cannot be installed: ${check.reason}`,
        );
      }
    }

    const moduleData: ProviderModule = {
      value: provider.value,
      sourceAuthor: provider.source.author,
      version: provider.version,
      modules,
      cachedAt: Date.now(),
    };

    if (!this.isTestRunning()) {
      extensionStorage.cacheProviderModules(moduleData);
    }

    return moduleData;
  }

  async installProvider(provider: ProviderExtension): Promise<boolean> {
    try {
      await this.downloadProviderModules(provider);
      extensionStorage.installProvider(provider);
      return true;
    } catch (error) {
      console.error(`Failed to install provider ${provider.display_name}:`, error);
      throw error;
    }
  }

  uninstallProvider(providerValue: string, sourceAuthor?: string): void {
    extensionStorage.uninstallProvider(providerValue, sourceAuthor);
  }

  async updateProvider(provider: ProviderExtension): Promise<boolean> {
    try {
      await this.downloadProviderModules(provider);
      extensionStorage.updateProviderVersion(
        provider.value,
        provider.version,
        provider.source?.author,
      );
      return true;
    } catch (error) {
      console.error(`Failed to update provider ${provider.display_name}:`, error);
      return false;
    }
  }

  getProviderModules(
    providerValue: string,
    sourceAuthor?: string,
  ): ProviderModule | undefined {
    return extensionStorage.getProviderModules(providerValue, sourceAuthor);
  }

  isProviderReady(providerValue: string, sourceAuthor?: string): boolean {
    const isInstalled = extensionStorage.isProviderInstalled(
      providerValue,
      sourceAuthor,
    );
    const modules = extensionStorage.getProviderModules(
      providerValue,
      sourceAuthor,
    );

    return !!(
      isInstalled &&
      modules &&
      modules.modules.posts &&
      modules.modules.meta &&
      modules.modules.stream &&
      modules.modules.catalog
    );
  }

  async ensureProviderLoaded(
    providerValue: string,
    sourceAuthor?: string,
  ): Promise<boolean> {
    if (this.isProviderReady(providerValue, sourceAuthor)) {
      return true;
    }

    const installed = extensionStorage
      .getInstalledProviders()
      .find(
        p =>
          p.value === providerValue &&
          (!sourceAuthor ||
            p.source?.author?.toLowerCase() === sourceAuthor.toLowerCase()),
      );

    if (!installed) {
      return false;
    }

    try {
      await this.downloadProviderModules(installed);
      return this.isProviderReady(providerValue, sourceAuthor);
    } catch (error) {
      console.error(`Failed to load provider ${providerValue}:`, error);
      return false;
    }
  }

  async initialize(): Promise<void> {
    const installed = extensionStorage.getInstalledProviders();
    const loadPromises = installed.map(provider =>
      this.ensureProviderLoaded(provider.value, provider.source?.author),
    );
    await Promise.allSettled(loadPromises);

    const sources = extensionStorage.getProviderSources();
    sources.forEach(source => {
      if (extensionStorage.shouldRefreshManifest(source.author)) {
        this.fetchManifest(source, false).catch(() => {});
      }
    });
  }

  async checkForUpdates(sourceAuthor?: string): Promise<ProviderExtension[]> {
    const sources = sourceAuthor
      ? extensionStorage
          .getProviderSources()
          .filter(s => s.author.toLowerCase() === sourceAuthor.toLowerCase())
      : extensionStorage.getProviderSources();

    for (const source of sources) {
      try {
        await this.fetchManifest(source, true);
      } catch {
        // Ignore network errors during update check
      }
    }
    return extensionStorage.getProvidersNeedingUpdate(sourceAuthor);
  }
}

export const extensionManager = ExtensionManager.getInstance();
