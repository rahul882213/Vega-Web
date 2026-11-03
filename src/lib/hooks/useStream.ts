import {useQuery} from '@tanstack/react-query';
import {useState, useEffect, useCallback} from 'react';
import {EpisodeLink, Stream} from '../providers/types';
import {providerManager} from '../services/ProviderManager';
import {settingsStorage} from '../storage';
import {showAppDialog} from '../zustand/appDialogStore';

interface UseStreamOptions {
  activeEpisode: EpisodeLink | null;
  routeParams: {
    linkList: EpisodeLink[];
    episodeIndex?: number;
    type: string;
    primaryTitle?: string;
    secondaryTitle?: string;
    poster: {
      logo?: string;
      poster?: string;
      background?: string;
    };
    file?: string;
    providerValue?: string;
    infoUrl?: string;
  };
  provider: string;
  enabled?: boolean;
}

export const useStream = ({
  activeEpisode,
  routeParams,
  provider,
  enabled = true,
}: UseStreamOptions) => {
  const [selectedStream, setSelectedStream] = useState<Stream>({
    server: '',
    link: '',
    type: '',
  });
  const [externalSubs, setExternalSubs] = useState<
    {title: string; language: string; type: any; uri: string}[]
  >([]);

  const effectiveProvider = routeParams?.providerValue || provider;

  const {
    data: streamData = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<Stream[], Error>({
    queryKey: [
      'stream',
      activeEpisode?.link,
      routeParams?.type,
      effectiveProvider,
      routeParams?.file,
    ],
    queryFn: async ({signal}) => {
      if (!activeEpisode?.link) {
        return [];
      }

      if (routeParams?.file) {
        return [
          {
            server: 'Downloaded',
            link: routeParams.file,
            type: 'mp4',
          },
        ];
      }

      const rawData = await providerManager.getStream({
        link: activeEpisode.link,
        type: routeParams?.type,
        signal,
        providerValue: effectiveProvider,
      });

      const normalizedData = (rawData || []).map(item => {
        const cleanServer = (item.server || 'Server')
          .replace(/^Unknown\s*·\s*/i, '')
          .trim();
        let cleanQuality = item.quality ? String(item.quality).trim() : undefined;
        if (
          !cleanQuality ||
          cleanQuality === '0' ||
          cleanQuality === '0p' ||
          cleanQuality.toLowerCase() === 'unknown' ||
          cleanQuality.toLowerCase() === 'nan'
        ) {
          const match = cleanServer.match(/\b(2160|1080|720|480|360)p?\b/i);
          cleanQuality = match ? match[1] : undefined;
        } else {
          cleanQuality = cleanQuality.replace(/p$/i, '');
        }
        return {
          ...item,
          server: cleanServer,
          quality: cleanQuality as Stream['quality'],
        };
      });

      // Deprioritize "download only" servers when streaming
      normalizedData.sort((a, b) => {
        const aDlOnly = a.server.toLowerCase().includes('download only') ? 1 : 0;
        const bDlOnly = b.server.toLowerCase().includes('download only') ? 1 : 0;
        return aDlOnly - bDlOnly;
      });

      const excludedQualities = settingsStorage.getExcludedQualities() || [];
      const filteredQualities = normalizedData.filter(
        streamItem =>
          !streamItem.quality ||
          !excludedQualities.includes(streamItem.quality + 'p'),
      );
      const filteredData =
        filteredQualities.length > 0 ? filteredQualities : normalizedData;

      if (!filteredData || filteredData.length === 0) {
        throw new Error('No Streams Available');
      }

      return filteredData;
    },
    enabled: enabled && !!activeEpisode?.link,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, err) => {
      if (err.message === 'No Streams Available') {
        return false;
      }
      return failureCount < 1;
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (streamData && streamData.length > 0) {
      setSelectedStream(streamData[0]);

      const subs: {title: string; language: string; type: any; uri: string}[] =
        [];
      streamData.forEach(track => {
        if (track?.subtitles?.length && track.subtitles.length > 0) {
          subs.push(...track.subtitles);
        }
      });
      setExternalSubs(subs);
    } else {
      setSelectedStream({server: '', link: '', type: ''});
      setExternalSubs([]);
    }
  }, [streamData]);

  const switchToNextStream = useCallback((): boolean => {
    if (!streamData || streamData.length <= 1) {
      return false;
    }
    const currentIndex = streamData.findIndex(
      s => s.link === selectedStream.link && s.server === selectedStream.server,
    );
    if (currentIndex !== -1 && currentIndex + 1 < streamData.length) {
      const next = streamData[currentIndex + 1];
      setSelectedStream(next);
      return true;
    }
    showAppDialog({
      title: 'Video could not be played',
      message: 'All available servers failed. Please try another source.',
      variant: 'error',
    });
    return false;
  }, [streamData, selectedStream]);

  return {
    stream: streamData,
    selectedStream,
    setSelectedStream,
    externalSubs,
    setExternalSubs,
    isLoading: isLoading || isFetching,
    error,
    refetch,
    switchToNextStream,
  };
};
