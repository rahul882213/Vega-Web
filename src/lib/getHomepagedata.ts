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
  const catalog = await providerManager.getCatalogAsync({
    providerValue: activeProvider.value,
    sourceAuthor: activeProvider.source?.author,
  });

  if (catalog.length === 0 || signal.aborted) {
    return [];
  }

  const fetchCategory = async (item: (typeof catalog)[number]): Promise<HomePageData> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) {
        return {title: item.title, Posts: [], filter: item.filter};
      }
      try {
        const data = await providerManager.getPosts({
          filter: item.filter,
          page: 1,
          providerValue: activeProvider.value,
          sourceAuthor: activeProvider.source?.author,
          signal,
        });
        const posts = Array.isArray(data) ? data : [];
        if (posts.length > 0 || attempt === 1) {
          return {
            title: item.title,
            Posts: posts,
            filter: item.filter,
          };
        }
      } catch (error) {
        if (attempt === 1) {
          return {
            title: item.title,
            Posts: [],
            filter: item.filter,
            error: error instanceof Error ? error.message : 'Failed to load',
          };
        }
      }
      await new Promise(r => setTimeout(r, 300));
    }
    return {title: item.title, Posts: [], filter: item.filter};
  };

  const results: HomePageData[] = new Array(catalog.length);
  const concurrency = 4;
  let nextIdx = 0;

  const workers = Array.from(
    {length: Math.min(concurrency, catalog.length)},
    async () => {
      while (nextIdx < catalog.length && !signal.aborted) {
        const current = nextIdx++;
        results[current] = await fetchCategory(catalog[current]);
      }
    },
  );

  await Promise.all(workers);
  const finalResults = results.filter(Boolean);
  const allEmptyWithErrors =
    finalResults.length > 0 &&
    finalResults.every(cat => cat.Posts.length === 0 && Boolean(cat.error));
  if (allEmptyWithErrors) {
    throw new Error(
      finalResults.find(cat => cat.error)?.error ||
        'Failed to load content from provider',
    );
  }
  return finalResults;
};
