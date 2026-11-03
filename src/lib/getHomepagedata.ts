import {Post} from './providers/types';
import {ProviderExtension} from './storage/extensionStorage';
import {providerManager} from './services/ProviderManager';

export interface HomePageData {
  title: string;
  Posts: Post[];
  filter: string;
  error?: string;
}

export const getHomePageData = async (
  activeProvider: ProviderExtension,
  signal: AbortSignal,
): Promise<HomePageData[]> => {
  const catalog = providerManager.getCatalog({
    providerValue: activeProvider.value,
    sourceAuthor: activeProvider.source?.author,
  });

  const fetchPromises = catalog.map(async item => {
    try {
      const data = await providerManager.getPosts({
        filter: item.filter,
        page: 1,
        providerValue: activeProvider.value,
        sourceAuthor: activeProvider.source?.author,
        signal,
      });

      if (signal.aborted) {
        return {
          title: item.title,
          Posts: [],
          filter: item.filter,
        };
      }

      return {
        title: item.title,
        Posts: Array.isArray(data) ? data : [],
        filter: item.filter,
      };
    } catch (error) {
      return {
        title: item.title,
        Posts: [],
        filter: item.filter,
        error: error instanceof Error ? error.message : 'Failed to load',
      };
    }
  });

  return Promise.all(fetchPromises);
};
