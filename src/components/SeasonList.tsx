import React, {useState, useEffect, useMemo} from 'react';
import {
  Play,
  Download,
  Search,
  ArrowUpDown,
  Check,
  MoreVertical,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {EpisodeLink, Link} from '../lib/providers/types';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation} from '../NavigationContext';
import {providerManager} from '../lib/services/ProviderManager';
import {mainStorage, cacheStorage} from '../lib/storage';
import useContinueWatchingStore from '../lib/zustand/continueWatchingStore';
import useDownloadsStore from '../lib/zustand/downloadsStore';
import {showAppDialog} from '../lib/zustand/appDialogStore';

interface SeasonListProps {
  LinkList: Link[];
  poster: {
    logo?: string;
    poster?: string;
    background?: string;
  };
  type: string;
  metaTitle: string;
  providerValue: string;
  sourceAuthor?: string;
  refreshing?: boolean;
  infoUrl: string;
  imdbId?: string;
  synopsis?: string;
}

const EPISODE_RANGE_SIZE = 50;

export const SeasonList: React.FC<SeasonListProps> = ({
  LinkList,
  poster,
  type,
  metaTitle,
  providerValue,
  sourceAuthor,
  infoUrl,
  imdbId,
  synopsis,
}) => {
  const colors = useM3Colors();
  const {navigate} = useVegaNavigation();
  const {items: continueWatchingItems, upsertItem} = useContinueWatchingStore();
  const {enqueueDownload, markCompleted, markError} = useDownloadsStore();

  const [activeSeasonIndex, setActiveSeasonIndex] = useState<number>(() => {
    const savedTitle = cacheStorage.getString(`ActiveSeason${metaTitle}${providerValue}`);
    if (savedTitle) {
      const idx = LinkList.findIndex(l => l.title === savedTitle);
      if (idx >= 0) return idx;
    }
    return 0;
  });

  const activeSeason = LinkList[activeSeasonIndex] || LinkList[0];

  const [episodes, setEpisodes] = useState<EpisodeLink[]>([]);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [episodeError, setEpisodeError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() =>
    mainStorage.getString('episodeSortOrder') === 'desc' ? 'desc' : 'asc',
  );
  const [selectedRangeStart, setSelectedRangeStart] = useState(0);
  const [menuOpenForLink, setMenuOpenForLink] = useState<string | null>(null);
  const [downloadingLink, setDownloadingLink] = useState<string | null>(null);
  const [, setWatchedTick] = useState(0);

  useEffect(() => {
    if (activeSeasonIndex >= LinkList.length) {
      setActiveSeasonIndex(0);
    }
  }, [LinkList.length, activeSeasonIndex]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadSeasonEpisodes() {
      if (!activeSeason) {
        setEpisodes([]);
        return;
      }

      if (
        Array.isArray(activeSeason.directLinks) &&
        activeSeason.directLinks.length > 0
      ) {
        setEpisodes(
          activeSeason.directLinks.map(d => ({
            title: d.title,
            link: d.link,
            description: d.description,
            image: d.image,
            skip: d.skip,
          })),
        );
        setEpisodeError(null);
        setEpisodeLoading(false);
        return;
      }

      if (!activeSeason.episodesLink) {
        setEpisodes([]);
        setEpisodeError(null);
        setEpisodeLoading(false);
        return;
      }

      setEpisodeLoading(true);
      setEpisodeError(null);
      try {
        const fetched = await providerManager.getEpisodes({
          url: activeSeason.episodesLink,
          providerValue,
          sourceAuthor,
          signal: controller.signal,
        });
        if (!cancelled) {
          setEpisodes(Array.isArray(fetched) ? fetched : []);
          setSelectedRangeStart(0);
        }
      } catch (err) {
        if (!cancelled) {
          setEpisodeError(
            err instanceof Error ? err.message : 'Failed to load episodes',
          );
          setEpisodes([]);
        }
      } finally {
        if (!cancelled) {
          setEpisodeLoading(false);
        }
      }
    }

    loadSeasonEpisodes();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeSeason, providerValue, sourceAuthor]);

  const isEpisodeCompleted = (link: string): boolean =>
    cacheStorage.getBool(`watched_${link}`, false);

  const setEpisodeCompleted = (link: string, watched: boolean) => {
    cacheStorage.setBool(`watched_${link}`, watched);
    setWatchedTick(t => t + 1);
  };

  const rangeSegments = useMemo(() => {
    if (episodes.length <= EPISODE_RANGE_SIZE) return [];
    const out: {start: number; end: number; label: string}[] = [];
    for (let start = 0; start < episodes.length; start += EPISODE_RANGE_SIZE) {
      const end = Math.min(start + EPISODE_RANGE_SIZE, episodes.length);
      out.push({start, end, label: `${start + 1}-${end}`});
    }
    return out;
  }, [episodes.length]);

  const filteredEpisodes = useMemo(() => {
    let base = episodes;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      base = episodes.filter(ep => ep.title?.toLowerCase().includes(q));
    } else if (episodes.length > EPISODE_RANGE_SIZE) {
      base = episodes.slice(
        selectedRangeStart,
        selectedRangeStart + EPISODE_RANGE_SIZE,
      );
    }
    const copy = [...base];
    return sortOrder === 'desc' ? copy.reverse() : copy;
  }, [episodes, searchText, selectedRangeStart, sortOrder]);

  const toggleSortOrder = () => {
    const next = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(next);
    mainStorage.setString('episodeSortOrder', next);
  };

  const handlePlay = (ep: EpisodeLink) => {
    const indexInAll = episodes.findIndex(e => e.link === ep.link);
    const resolvedIndex = indexInAll >= 0 ? indexInAll : 0;

    upsertItem({
      id: infoUrl || metaTitle,
      title: metaTitle,
      episodeTitle: ep.title,
      seasonTitle: activeSeason?.title,
      episode: ep,
      type,
      poster: poster.poster,
      background: poster.background,
      providerValue,
      infoUrl,
      position: 0,
      duration: 0,
      updatedAt: Date.now(),
    });

    navigate({
      name: 'Player',
      params: {
        linkList: episodes.length > 0 ? episodes : [ep],
        episodeIndex: resolvedIndex,
        type,
        primaryTitle: metaTitle,
        secondaryTitle: ep.title,
        seasonTitle: activeSeason?.title,
        poster,
        providerValue,
        infoUrl,
        imdbId,
        synopsis,
      },
    });
  };

  const handleDownload = async (ep: EpisodeLink) => {
    if (downloadingLink) return;
    setDownloadingLink(ep.link);
    try {
      const controller = new AbortController();
      const streams = await providerManager.getStream({
        link: ep.link,
        type,
        providerValue,
        sourceAuthor,
        isDownload: true,
        signal: controller.signal,
      });

      if (!streams || streams.length === 0) {
        showAppDialog({
          title: 'No Download Stream Available',
          message: 'Provider did not return any downloadable streams for this item.',
          variant: 'warning',
        });
        return;
      }

      const chosen = streams[0];
      const downloadId = `${providerValue}:${ep.link}`;
      enqueueDownload({
        id: downloadId,
        title: `${metaTitle} - ${ep.title}`,
        showName: metaTitle,
        episodeName: ep.title,
        seasonTitle: activeSeason?.title,
        type: type === 'series' ? 'series' : 'movie',
        url: chosen.link,
        poster: poster.poster,
        background: poster.background,
        provider: providerValue,
        infoUrl,
        sourceLink: ep.link,
        headers: chosen.headers,
        server: chosen.server,
        quality: chosen.quality,
      });

      // Trigger browser download via proxy if direct video, or save in Downloads tab
      const encodedHeaders = chosen.headers
        ? window.btoa(JSON.stringify(chosen.headers))
        : '';
      const proxyUrl = `/api/stream-proxy?url=${encodeURIComponent(chosen.link)}${
        encodedHeaders ? `&headers=${encodeURIComponent(encodedHeaders)}` : ''
      }`;

      if (!chosen.link.includes('.m3u8')) {
        const a = document.createElement('a');
        a.href = proxyUrl;
        a.download = `${metaTitle} - ${ep.title}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      markCompleted(downloadId);
      showAppDialog({
        title: 'Added to Downloads',
        message: `${metaTitle} (${ep.title}) via ${chosen.server}${
          chosen.quality ? ` • ${chosen.quality}p` : ''
        } has been added to Downloads.`,
        variant: 'success',
      });
    } catch (err) {
      markError(
        `${providerValue}:${ep.link}`,
        err instanceof Error ? err.message : 'Download failed',
      );
      showAppDialog({
        title: 'Download Failed',
        message: err instanceof Error ? err.message : 'Could not resolve download stream.',
        variant: 'error',
      });
    } finally {
      setDownloadingLink(null);
    }
  };

  const resumeItem = continueWatchingItems.find(
    item => item.id === (infoUrl || metaTitle) && item.providerValue === providerValue,
  );

  if (!LinkList || LinkList.length === 0) {
    return (
      <div className="py-10 text-center">
        <AlertTriangle
          size={28}
          className="mx-auto mb-2"
          style={{color: colors.onSurfaceVariant}}
        />
        <p className="text-sm" style={{color: colors.onSurfaceVariant}}>
          No streams or episodes available from this provider.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Season / Version Selector Dropdown */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <select
            value={activeSeasonIndex}
            onChange={e => {
              const idx = Number(e.target.value);
              setActiveSeasonIndex(idx);
              if (LinkList[idx]?.title) {
                cacheStorage.setString(
                  `ActiveSeason${metaTitle}${providerValue}`,
                  LinkList[idx].title,
                );
              }
            }}
            className="w-full h-12 pl-4 pr-10 rounded-xl border appearance-none text-sm font-semibold outline-none cursor-pointer"
            style={{
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
              color: colors.primary,
            }}>
            {LinkList.map((season, idx) => (
              <option
                key={`${season.title}-${idx}`}
                value={idx}
                style={{
                  backgroundColor: colors.surfaceContainerHigh,
                  color: colors.onSurface,
                }}>
                {season.title}
                {season.quality ? ` (${season.quality})` : ''}
              </option>
            ))}
          </select>
          <ChevronDown
            size={18}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{color: colors.onSurfaceVariant}}
          />
        </div>
      </div>

      {/* Episode Range Chips (when > 50 episodes) */}
      {rangeSegments.length > 0 && !searchText.trim() && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
          {rangeSegments.map(seg => {
            const active = selectedRangeStart === seg.start;
            return (
              <button
                key={seg.start}
                onClick={() => setSelectedRangeStart(seg.start)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border shrink-0 transition-colors cursor-pointer"
                style={{
                  backgroundColor: active
                    ? colors.secondaryContainer
                    : colors.surfaceContainerLow,
                  borderColor: active
                    ? colors.secondaryContainer
                    : colors.outlineVariant,
                  color: active
                    ? colors.onSecondaryContainer
                    : colors.onSurfaceVariant,
                }}>
                {seg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Search & Sort Bar (when > 6 episodes) */}
      {episodes.length > 6 && (
        <div className="flex items-center gap-2 mb-3">
          <div
            className="flex-1 flex items-center h-10 px-3.5 rounded-xl border"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            }}>
            <Search
              size={15}
              className="mr-2.5 shrink-0"
              style={{color: colors.onSurfaceVariant}}
            />
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search episodes or versions..."
              className="w-full bg-transparent text-xs outline-none"
              style={{color: colors.onSurface}}
            />
          </div>

          <button
            onClick={toggleSortOrder}
            className="h-10 px-3.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
              color: colors.onSurface,
            }}
            title="Sort order">
            <ArrowUpDown size={14} style={{color: colors.primary}} />
            <span>{sortOrder === 'asc' ? 'Asc' : 'Desc'}</span>
          </button>
        </div>
      )}

      {/* Resume Banner */}
      {resumeItem && (
        <div
          onClick={() => handlePlay(resumeItem.episode)}
          className="mb-3 p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-opacity hover:opacity-95"
          style={{
            backgroundColor: colors.secondaryContainer,
            borderColor: colors.outlineVariant,
          }}>
          <div className="min-w-0">
            <p
              className="text-[11px] font-bold uppercase tracking-wider opacity-80"
              style={{color: colors.onSecondaryContainer}}>
              Resume Playback
            </p>
            <p
              className="text-sm font-semibold truncate"
              style={{color: colors.onSecondaryContainer}}>
              {resumeItem.episodeTitle || resumeItem.episode.title}
            </p>
          </div>
          <div
            className="px-4 py-2 rounded-full flex items-center gap-1.5 text-xs font-bold shrink-0"
            style={{
              backgroundColor: colors.primary,
              color: colors.onPrimary,
            }}>
            <Play size={14} fill="currentColor" />
            <span>Resume</span>
          </div>
        </div>
      )}

      {/* Episode / DirectLink List */}
      {episodeLoading ? (
        <div className="space-y-2.5 py-2">
          {Array.from({length: 5}).map((_, idx) => (
            <div
              key={idx}
              className="h-14 rounded-xl animate-pulse"
              style={{backgroundColor: colors.surfaceContainerHigh}}
            />
          ))}
        </div>
      ) : episodeError ? (
        <div
          className="p-6 rounded-2xl border text-center my-2"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <AlertTriangle
            size={26}
            className="mx-auto mb-2"
            style={{color: colors.error}}
          />
          <p
            className="text-sm font-semibold mb-1"
            style={{color: colors.onSurface}}>
            Failed to load episodes
          </p>
          <p
            className="text-xs mb-4"
            style={{color: colors.onSurfaceVariant}}>
            {episodeError}
          </p>
          <button
            onClick={() => setActiveSeasonIndex(i => i)}
            className="px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            style={{
              backgroundColor: colors.primary,
              color: colors.onPrimary,
            }}>
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
        </div>
      ) : filteredEpisodes.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm" style={{color: colors.onSurfaceVariant}}>
            {searchText
              ? `No episodes matching "${searchText}"`
              : 'No playable links found'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 pb-8">
          {filteredEpisodes.map((ep, idx) => {
            const watched = isEpisodeCompleted(ep.link);
            const isMenuOpen = menuOpenForLink === ep.link;
            const isDownloading = downloadingLink === ep.link;

            return (
              <div
                key={`${ep.link}-${idx}`}
                className="relative rounded-xl border px-3.5 py-3 flex items-center justify-between gap-3 transition-colors hover:bg-white/[0.03]"
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                  opacity: watched ? 0.6 : 1,
                }}>
                <button
                  onClick={() => handlePlay(ep)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: watched
                        ? colors.surfaceContainerHighest
                        : colors.primaryContainer,
                      color: watched
                        ? colors.onSurfaceVariant
                        : colors.onPrimaryContainer,
                    }}>
                    {watched ? (
                      <Check size={16} />
                    ) : (
                      <Play size={15} fill="currentColor" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium truncate"
                      style={{color: colors.onSurface}}>
                      {ep.title || `Episode ${idx + 1}`}
                    </p>
                    <p
                      className="text-[11px] truncate"
                      style={{color: colors.onSurfaceVariant}}>
                      {watched ? 'Watched • Tap to replay' : 'Tap to resolve streams & play'}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleDownload(ep)}
                    disabled={isDownloading}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
                    style={{color: colors.onSurfaceVariant}}
                    title="Download">
                    <Download
                      size={17}
                      className={isDownloading ? 'animate-bounce' : ''}
                    />
                  </button>

                  <button
                    onClick={() =>
                      setMenuOpenForLink(isMenuOpen ? null : ep.link)
                    }
                    className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                    style={{color: colors.onSurfaceVariant}}
                    title="Episode actions">
                    <MoreVertical size={17} />
                  </button>
                </div>

                {/* Context Menu */}
                {isMenuOpen && (
                  <div
                    className="absolute right-3 top-12 z-30 w-52 rounded-2xl border shadow-2xl py-1.5 overflow-hidden"
                    style={{
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: colors.outlineVariant,
                    }}>
                    <button
                      onClick={() => {
                        setEpisodeCompleted(ep.link, !watched);
                        setMenuOpenForLink(null);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-white/10 cursor-pointer"
                      style={{color: colors.onSurface}}>
                      {watched ? 'Mark as unwatched' : 'Mark as watched'}
                    </button>
                    <button
                      onClick={() => {
                        const targetIdx = episodes.findIndex(
                          e => e.link === ep.link,
                        );
                        for (let i = 0; i < targetIdx; i++) {
                          cacheStorage.setBool(
                            `watched_${episodes[i].link}`,
                            true,
                          );
                        }
                        setWatchedTick(t => t + 1);
                        setMenuOpenForLink(null);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-white/10 cursor-pointer"
                      style={{color: colors.onSurface}}>
                      Mark previous as watched
                    </button>
                    <button
                      onClick={() => {
                        episodes.forEach(e =>
                          cacheStorage.setBool(`watched_${e.link}`, true),
                        );
                        setWatchedTick(t => t + 1);
                        setMenuOpenForLink(null);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-white/10 cursor-pointer"
                      style={{color: colors.onSurface}}>
                      Mark all as watched
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
