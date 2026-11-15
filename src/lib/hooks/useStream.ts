import {useQuery} from '@tanstack/react-query';
import {useState, useEffect, useCallback, useRef} from 'react';
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

export function isLikelyWebpageUrl(rawUrl: string): boolean {
  const lower = (rawUrl || '').toLowerCase();
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
    if (
      !linkLower.includes('.mp4') &&
      !linkLower.includes('.m3u8') &&
      !linkLower.includes('.mpd')
    ) {
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

function qualityRank(q?: string): number {
  const n = Number(String(q || '').replace(/p$/i, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n === 720) return 4;
  if (n === 1080) return 3;
  if (n === 480) return 2;
  if (n === 2160) return 2;
  if (n === 360) return 1;
  return 1;
}

function pickBestInitialStreamIndex(list: Stream[]): number {
  if (!list || list.length === 0) return -1;
  let bestIdx = 0;
  for (let i = 1; i < list.length; i++) {
    const cur = list[i];
    const best = list[bestIdx];
    const scoreDiff = scoreStreamCandidate(cur) - scoreStreamCandidate(best);
    if (scoreDiff < 0) {
      bestIdx = i;
    } else if (scoreDiff === 0 && qualityRank(cur.quality) > qualityRank(best.quality)) {
      bestIdx = i;
    }
  }
  return bestIdx;
}

export const useStream = ({
  activeEpisode,
  routeParams,
  provider,
  enabled = true,
}: UseStreamOptions) => {
  const [selectedStream, setSelectedStreamState] = useState<Stream>({
    server: '',
    link: '',
    type: '',
  });
  const [selectedStreamIndex, setSelectedStreamIndex] = useState<number>(-1);
  const [streamSelectionRevision, setStreamSelectionRevision] = useState<number>(0);
  const [externalSubs, setExternalSubs] = useState<
    {title: string; language: string; type: any; uri: string}[]
  >([]);

  const triedIndicesRef = useRef<Set<number>>(new Set());
  const isManualSelectionRef = useRef<boolean>(false);

  const effectiveProvider = routeParams?.providerValue || provider;
  const effectiveAuthor = routeParams?.sourceAuthor;

  // Immediately clear stale stream state when episode/source changes so previous movie URLs are never reused
  useEffect(() => {
    triedIndicesRef.current = new Set();
    isManualSelectionRef.current = false;
    setSelectedStreamState({server: '', link: '', type: ''});
    setSelectedStreamIndex(-1);
    setStreamSelectionRevision(r => r + 1);
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

      // Preserve every valid server entry returned by the provider without dropping webpage/download links or duplicate server names
      const normalizedData = (rawData || [])
        .filter(
          item => item && typeof item.link === 'string' && item.link.trim() !== '',
        )
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
      const initialIndex = pickBestInitialStreamIndex(streamData);
      const chosenIndex = initialIndex >= 0 ? initialIndex : 0;
      triedIndicesRef.current = new Set([chosenIndex]);
      isManualSelectionRef.current = false;
      setSelectedStreamIndex(chosenIndex);
      setSelectedStreamState(streamData[chosenIndex]);
      setStreamSelectionRevision(r => r + 1);

      const subs: {title: string; language: string; type: any; uri: string}[] =
        [];
      streamData.forEach(track => {
        if (track?.subtitles?.length && track.subtitles.length > 0) {
          subs.push(...track.subtitles);
        }
      });
      setExternalSubs(subs);
    } else {
      triedIndicesRef.current = new Set();
      isManualSelectionRef.current = false;
      setSelectedStreamIndex(-1);
      setSelectedStreamState({server: '', link: '', type: ''});
      setExternalSubs([]);
    }
  }, [streamData]);

  const setSelectedStream = useCallback(
    (stream: Stream, explicitIndex?: number) => {
      let resolvedIndex = -1;
      if (
        typeof explicitIndex === 'number' &&
        explicitIndex >= 0 &&
        explicitIndex < streamData.length
      ) {
        resolvedIndex = explicitIndex;
      } else {
        resolvedIndex = streamData.findIndex(
          s => s.link === stream.link && s.server === stream.server,
        );
      }
      isManualSelectionRef.current = true;
      triedIndicesRef.current =
        resolvedIndex >= 0 ? new Set([resolvedIndex]) : new Set();
      setSelectedStreamIndex(resolvedIndex);
      setSelectedStreamState(stream);
      setStreamSelectionRevision(r => r + 1);
    },
    [streamData],
  );

  const switchToNextStream = useCallback((): boolean => {
    if (isManualSelectionRef.current) {
      // Do not override a user-selected server; let the error overlay allow manual switching
      return false;
    }
    if (!streamData || streamData.length <= 1) {
      return false;
    }

    const currentIdx =
      selectedStreamIndex >= 0 && selectedStreamIndex < streamData.length
        ? selectedStreamIndex
        : streamData.findIndex(
            s => s.link === selectedStream.link && s.server === selectedStream.server,
          );

    if (currentIdx >= 0) {
      triedIndicesRef.current.add(currentIdx);
    }

    // Build ordered candidate indices starting right after currentIdx
    const orderedCandidates: number[] = [];
    for (let offset = 1; offset <= streamData.length; offset++) {
      const idx =
        currentIdx >= 0
          ? (currentIdx + offset) % streamData.length
          : offset - 1;
      if (!triedIndicesRef.current.has(idx)) {
        orderedCandidates.push(idx);
      }
    }

    // Prefer untried non-webpage media streams during auto-fallback
    const nextIdx = orderedCandidates.find(
      idx => !isLikelyWebpageUrl(streamData[idx].link),
    );

    if (nextIdx !== undefined) {
      triedIndicesRef.current.add(nextIdx);
      setSelectedStreamIndex(nextIdx);
      setSelectedStreamState(streamData[nextIdx]);
      setStreamSelectionRevision(r => r + 1);
      return true;
    }

    showAppDialog({
      title: 'Video could not be played',
      message: 'All playable servers failed. Choose another server or external player.',
      variant: 'error',
    });
    return false;
  }, [streamData, selectedStream, selectedStreamIndex]);

  return {
    stream: streamData,
    selectedStream,
    selectedStreamIndex,
    streamSelectionRevision,
    setSelectedStream,
    externalSubs,
    setExternalSubs,
    isLoading: isLoading || isFetching,
    error,
    refetch,
    switchToNextStream,
  };
};
