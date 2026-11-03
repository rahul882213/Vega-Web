import {useQuery} from '@tanstack/react-query';
import {providerManager} from '../services/ProviderManager';
import {proxyFetch} from '../sandbox/sandboxRuntime';
import {Info} from '../providers/types';

export const useContentDetails = (
  link: string,
  providerValue: string,
  sourceAuthor?: string,
) => {
  const {
    data: info,
    isLoading: infoLoading,
    error: infoError,
    refetch: refetchInfo,
  } = useQuery<Info>({
    queryKey: ['contentMeta', link, providerValue, sourceAuthor || ''],
    queryFn: async ({signal}) => {
      return await providerManager.getMeta({
        link,
        provider: providerValue,
        sourceAuthor,
        signal,
      });
    },
    enabled: Boolean(link && providerValue),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
  });

  const shouldFetchCinemeta =
    Boolean(info?.imdbId) && info?.populateMeta !== false;

  const {
    data: meta,
    isLoading: metaLoading,
    error: metaError,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ['cinemeta', info?.imdbId, info?.type],
    queryFn: async ({signal}) => {
      const type = info?.type === 'series' ? 'series' : 'movie';
      const url = `https://v3-cinemeta.strem.io/meta/${type}/${info!.imdbId}.json`;
      const res = await proxyFetch('cinemeta', url, {method: 'GET', signal});
      if (res.status >= 200 && res.status < 300 && res.bodyText) {
        const parsed = JSON.parse(res.bodyText);
        return parsed?.meta || null;
      }
      return null;
    },
    enabled: shouldFetchCinemeta,
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 1,
  });

  return {
    info,
    meta,
    isLoading: infoLoading || (shouldFetchCinemeta && metaLoading),
    error: infoError || metaError,
    refetch: async () => {
      await Promise.all([
        refetchInfo(),
        ...(shouldFetchCinemeta ? [refetchMeta()] : []),
      ]);
    },
  };
};
