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
    sourceAuthor?: string;
    infoUrl?: string;
  };
  provider: string;
  enabled?: boolean;
}

function isLikelyWebpageUrl(rawUrl: string): boolean {
  const lower = rawUrl.toLowerCase();
  if (!lower) return true;
  if (lower.includes('/how2download')) return true;
  if (lower.includes('#dl')) return true;
  return false;
}

function scoreStreamCandidate(item: Stream): number {
  const linkLower = (item.link || '').toLowerCase();
  const serverLower = (item.server || '').toLowerCase();
  const typeLower = (item.type || '').toLowerCase();

  let score = 0;
  if (isLikelyWebpageUrl(linkLower)) score += 100;
  if (serverLower.includes('download only')) score += 50;
  if (
    serverLower.includes('instantcloud') ||
    serverLower.includes('xcloud') ||
    serverLower === 'gp'
  ) {
    if (!linkLower.includes('.mp4') && !linkLower.includes('.m3u8') && !linkLower.includes('.mpd')) {
      score += 40;
    }
  }
  if (
    typeLower === 'm3u8' ||
    typeLower === 'mpd' ||
    typeLower === 'dash' ||
    typeLower === 'mp4' ||
    linkLower.includes('.m3u8') ||
    linkLower.includes('.mpd') ||
    linkLower.includes('.mp4') ||
    linkLower.includes('r2.cloudflarestorage.com') ||
    linkLower.includes('workers.dev') ||
    linkLower.includes('hakunaymatata.com') ||
    linkLower.includes('video-downloads.googleusercontent.com')
  ) {
    score -= 10;
  }
  return score;
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
  const effectiveAuthor = routeParams?.sourceAuthor;

  // Immediately clear stale stream state when episode/source changes so previous movie URLs are never reused
  useEffect(() => {
    setSelectedStream({server: '', link: '', type: ''});
    setExternalSubs([]);
  }, [activeEpisode?.link, effectiveProvider, routeParams?.file]);

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
      effectiveAuthor || '',
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
        sourceAuthor: effectiveAuthor,
      });

      const normalizedData = (rawData || [])
        .filter(item => item && typeof item.link === 'string' && item.link.trim() !== '')
        .map(item => {
          const cleanLink = item.link.trim();
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
          const lowerLink = cleanLink.toLowerCase();
          const inferredType =
            item.type && item.type.trim()
              ? item.type.trim()
              : lowerLink.includes('.m3u8')
                ? 'm3u8'
                : lowerLink.includes('.mpd')
                  ? 'mpd'
                  : 'mp4';
          return {
            ...item,
            link: cleanLink,
            type: inferredType,
            server: cleanServer,
            quality: cleanQuality as Stream['quality'],
          };
        });

      // Drop obvious HTML instruction/landing pages whenever real stream candidates exist
      const mediaCandidates = normalizedData.filter(
        item => !isLikelyWebpageUrl(item.link),
      );
      const validPool =
        mediaCandidates.length > 0
          ? mediaCandidates
          : normalizedData.filter(
              item => !item.link.toLowerCase().includes('/how2download'),
            );

      const finalPool = validPool.length > 0 ? validPool : normalizedData;

      // Prioritize direct playable media streams over webpage / download-only candidates
      finalPool.sort((a, b) => scoreStreamCandidate(a) - scoreStreamCandidate(b));

      const excludedQualities = settingsStorage.getExcludedQualities() || [];
      const filteredQualities = finalPool.filter(
        streamItem =>
          !streamItem.quality ||
          !excludedQualities.includes(streamItem.quality + 'p'),
      );
      const filteredData =
        filteredQualities.length > 0 ? filteredQualities : finalPool;

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
