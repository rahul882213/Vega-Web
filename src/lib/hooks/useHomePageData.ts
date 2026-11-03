import {useQuery} from '@tanstack/react-query';
import {getHomePageData, HomePageData} from '../getHomepagedata';
import {ProviderExtension} from '../storage/extensionStorage';
import {Post} from '../providers/types';
import {useMemo} from 'react';

const MAX_HERO_CANDIDATES = 12;

export const selectHeroPosts = (categories?: HomePageData[]): Post[] => {
  if (!categories || categories.length === 0) {
    return [];
  }

  for (let i = categories.length - 1; i >= 0; i--) {
    const posts = categories[i]?.Posts;
    if (!posts || posts.length === 0) {
      continue;
    }
    const seen = new Set<string>();
    const unique: Post[] = [];
    for (const post of posts) {
      if (!post?.link || !post.image || seen.has(post.link)) {
        continue;
      }
      seen.add(post.link);
      unique.push(post);
      if (unique.length >= MAX_HERO_CANDIDATES) {
        break;
      }
    }
    if (unique.length > 0) {
      return unique;
    }
  }
  return [];
};

interface UseHomePageDataOptions {
  provider: ProviderExtension;
  enabled?: boolean;
}

export const useHomePageData = ({
  provider,
  enabled = true,
}: UseHomePageDataOptions) => {
  const query = useQuery<HomePageData[], Error>({
    queryKey: [
      'homePageData',
      provider.value,
      provider.source?.author || '',
      provider.version,
    ],
    queryFn: async ({signal}) => {
      return await getHomePageData(provider, signal);
    },
    enabled: enabled && !!provider?.value,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  });

  const heroPosts = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return [];
    }
    return selectHeroPosts(query.data);
  }, [query.data]);

  return {
    ...query,
    categories: query.data || [],
    heroPosts,
    heroPost: heroPosts[0] ?? null,
  };
};
