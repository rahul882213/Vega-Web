import {
  Catalog,
  EpisodeLink,
  Info,
  Post,
  ProviderActionResult,
  ProviderSettingItem,
  Stream,
} from '../providers/types';
import {extensionStorage, providerKvStorage} from '../storage';
import {
  runProviderCatalog,
  runProviderEpisodes,
  runProviderMeta,
  runProviderPosts,
  runProviderSearchPosts,
  runProviderSettingsAction,
  runProviderSettingsSchema,
  runProviderStream,
} from '../sandbox/sandboxRuntime';

export class ProviderManager {
  private resolveSourceAuthor(
    providerValue: string,
    explicitAuthor?: string,
  ): string | undefined {
    if (explicitAuthor) {
      return explicitAuthor;
    }
    const installed = extensionStorage
      .getInstalledProviders()
      .find(p => p.value === providerValue);
    return (
      installed?.source?.author ||
      extensionStorage.getDefaultProviderSource()?.author
    );
  }

  private getProviderModule(providerValue: string, sourceAuthor?: string) {
    const author = this.resolveSourceAuthor(providerValue, sourceAuthor);
    return {
      author,
      module: extensionStorage.getProviderModules(providerValue, author),
    };
  }

  getCatalog({
    providerValue,
    sourceAuthor,
  }: {
    providerValue: string;
    sourceAuthor?: string;
  }): Catalog[] {
    const {author, module: catalogModule} = this.getProviderModule(
      providerValue,
      sourceAuthor,
    );
    if (!catalogModule?.modules.catalog) {
      return [];
    }
    try {
      const exports: Record<string, any> = {};
      const mod = {exports};
      const fn = new Function('exports', 'module', catalogModule.modules.catalog);
      fn(exports, mod);
      if (Array.isArray(mod.exports.catalog)) {
        return mod.exports.catalog;
      }
    } catch {
      // Fallback handled by async or empty
    }
    runProviderCatalog(catalogModule.modules.catalog, providerValue, author).catch(
      () => {},
    );
    return [];
  }

  getGenres({
    providerValue,
    sourceAuthor,
  }: {
    providerValue: string;
    sourceAuthor?: string;
  }): Catalog[] {
    const {module: catalogModule} = this.getProviderModule(
      providerValue,
      sourceAuthor,
    );
    if (!catalogModule?.modules.catalog) {
      return [];
    }
    try {
      const exports: Record<string, any> = {};
      const mod = {exports};
      const fn = new Function('exports', 'module', catalogModule.modules.catalog);
      fn(exports, mod);
      if (Array.isArray(mod.exports.genres)) {
        return mod.exports.genres;
      }
    } catch {
      // Ignore
    }
    return [];
  }

  async getPosts({
    filter,
    page,
    providerValue,
    signal,
    sourceAuthor,
  }: {
    filter: string;
    page: number;
    providerValue: string;
    signal: AbortSignal;
    sourceAuthor?: string;
  }): Promise<Post[]> {
    const {author, module: getPostsModule} = this.getProviderModule(
      providerValue,
      sourceAuthor,
    );
    if (!getPostsModule?.modules.posts) {
      throw new Error(`No posts module found for provider: ${providerValue}`);
    }
    return await runProviderPosts(getPostsModule.modules.posts, {
      filter,
      page,
      providerValue,
      signal,
      sourceAuthor: author,
    });
  }

  async getSearchPosts({
    searchQuery,
    page,
    providerValue,
    signal,
    sourceAuthor,
  }: {
    searchQuery: string;
    page: number;
    providerValue: string;
    signal: AbortSignal;
    sourceAuthor?: string;
  }): Promise<Post[]> {
    const {author, module: getPostsModule} = this.getProviderModule(
      providerValue,
      sourceAuthor,
    );
    if (!getPostsModule?.modules.posts) {
      throw new Error(`No posts module found for provider: ${providerValue}`);
    }
    return await runProviderSearchPosts(getPostsModule.modules.posts, {
      searchQuery,
      page,
      providerValue,
      signal,
      sourceAuthor: author,
    });
  }

  async getMeta({
    link,
    provider,
    signal,
    sourceAuthor,
  }: {
    link: string;
    provider: string;
    signal?: AbortSignal;
    sourceAuthor?: string;
  }): Promise<Info> {
    const {author, module: getMetaModule} = this.getProviderModule(
      provider,
      sourceAuthor,
    );
    if (!getMetaModule?.modules.meta) {
      throw new Error(`No meta module found for provider: ${provider}`);
    }
    return await runProviderMeta(getMetaModule.modules.meta, {
      link,
      provider,
      signal,
      sourceAuthor: author,
    });
  }

  async getStream({
    link,
    type,
    signal,
    providerValue,
    isDownload = false,
    sourceAuthor,
  }: {
    link: string;
    type: string;
    signal: AbortSignal;
    providerValue: string;
    isDownload?: boolean;
    sourceAuthor?: string;
  }): Promise<Stream[]> {
    const {author, module: getStreamModule} = this.getProviderModule(
      providerValue,
      sourceAuthor,
    );
    if (!getStreamModule?.modules.stream) {
      throw new Error(`No stream module found for provider: ${providerValue}`);
    }
    return await runProviderStream(getStreamModule.modules.stream, {
      link,
      type,
      providerValue,
      isDownload,
      signal,
      sourceAuthor: author,
    });
  }

  async getEpisodes({
    url,
    providerValue,
    signal,
    sourceAuthor,
  }: {
    url: string;
    providerValue: string;
    signal?: AbortSignal;
    sourceAuthor?: string;
  }): Promise<EpisodeLink[]> {
    const {author, module: getEpisodeLinksModule} = this.getProviderModule(
      providerValue,
      sourceAuthor,
    );
    if (!getEpisodeLinksModule?.modules.episodes) {
      throw new Error(
        `No episodes module found for provider: ${providerValue}`,
      );
    }
    return await runProviderEpisodes(getEpisodeLinksModule.modules.episodes, {
      url,
      providerValue,
      signal,
      sourceAuthor: author,
    });
  }

  hasProviderSettings(providerValue: string, sourceAuthor?: string): boolean {
    const {module: providerModule} = this.getProviderModule(
      providerValue,
      sourceAuthor,
    );
    return Boolean(providerModule?.modules.settings);
  }

  async getSettingsSchema({
    providerValue,
    signal,
    sourceAuthor,
  }: {
    providerValue: string;
    signal?: AbortSignal;
    sourceAuthor?: string;
  }): Promise<ProviderSettingItem[]> {
    const {author, module: providerModule} = this.getProviderModule(
      providerValue,
      sourceAuthor,
    );
    const code = providerModule?.modules.settings;
    if (!code) {
      return [];
    }
    return await runProviderSettingsSchema(code, {
      providerValue,
      signal,
      sourceAuthor: author,
    });
  }

  async onSettingsAction({
    providerValue,
    key,
    signal,
    sourceAuthor,
  }: {
    providerValue: string;
    key: string;
    signal?: AbortSignal;
    sourceAuthor?: string;
  }): Promise<ProviderActionResult> {
    const {author, module: providerModule} = this.getProviderModule(
      providerValue,
      sourceAuthor,
    );
    const code = providerModule?.modules.settings;
    if (!code) {
      return {};
    }
    return await runProviderSettingsAction(code, {
      key,
      providerValue,
      signal,
      sourceAuthor: author,
    });
  }

  getSettingValue(
    providerValue: string,
    item: ProviderSettingItem,
    sourceAuthor?: string,
  ): boolean | string | string[] {
    const author =
      this.resolveSourceAuthor(providerValue, sourceAuthor) || 'default';
    const scopedKey = `${author.toLowerCase()}:${providerValue}:${item.key}`;
    if (item.type === 'toggle') {
      return providerKvStorage.getBool(scopedKey, Boolean(item.defaultValue));
    }
    if (item.type === 'multiselect') {
      const storedArr = providerKvStorage.getArray<string>(scopedKey);
      if (Array.isArray(storedArr)) {
        return storedArr.map(String);
      }
      return Array.isArray(item.defaultValue) ? item.defaultValue : [];
    }
    const stored = providerKvStorage.getString(scopedKey);
    if (stored !== undefined) {
      return stored;
    }
    return 'defaultValue' in item && item.defaultValue !== undefined
      ? item.defaultValue
      : '';
  }

  setSettingValue(
    providerValue: string,
    item: ProviderSettingItem,
    value: boolean | string | string[],
    sourceAuthor?: string,
  ): void {
    const author =
      this.resolveSourceAuthor(providerValue, sourceAuthor) || 'default';
    const scopedKey = `${author.toLowerCase()}:${providerValue}:${item.key}`;
    if (item.type === 'toggle') {
      providerKvStorage.setBool(scopedKey, Boolean(value));
    } else if (item.type === 'multiselect') {
      providerKvStorage.setArray(
        scopedKey,
        Array.isArray(value) ? value.map(String) : [String(value)],
      );
    } else {
      providerKvStorage.setString(scopedKey, String(value));
    }
  }

  async resetSettings(
    providerValue: string,
    sourceAuthor?: string,
  ): Promise<void> {
    const author =
      this.resolveSourceAuthor(providerValue, sourceAuthor) || 'default';
    const prefix = `${author.toLowerCase()}:${providerValue}:`;
    const allKeys = await providerKvStorage.getKeys();
    allKeys
      .filter(k => k.startsWith(prefix))
      .forEach(k => providerKvStorage.delete(k));
  }
}

export const providerManager = new ProviderManager();
