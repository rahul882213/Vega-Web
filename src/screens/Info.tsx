import React, {useState} from 'react';
import {
  ArrowLeft,
  Search,
  Globe,
  Sparkles,
  Bookmark,
  Check,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react';
import {useVegaNavigation, InfoRouteParams} from '../NavigationContext';
import useContentStore from '../lib/zustand/contentStore';
import useWatchListStore from '../lib/zustand/watchListStore';
import {useContentDetails} from '../lib/hooks/useContentInfo';
import {useDetailSeedPalette} from '../theme/detailPalette';
import {SeasonList} from '../components/SeasonList';
import {m3SemanticColors} from '../theme/colors';

export const Info: React.FC<{routeParams: InfoRouteParams}> = ({
  routeParams,
}) => {
  const {goBack, navigate} = useVegaNavigation();
  const {provider, installedProviders} = useContentStore();
  const {watchList, addItem, removeItem, collections, setItemCollections} =
    useWatchListStore();

  const activeProviderValue = routeParams.provider || provider.value;
  const matchedInstalled = installedProviders.find(
    p => p.value === activeProviderValue,
  );

  const {info, meta, isLoading, error, refetch} = useContentDetails(
    routeParams.link,
    activeProviderValue,
    matchedInstalled?.source?.author,
  );

  const posterImage =
    meta?.poster || info?.poster || info?.image || routeParams.poster || '';
  const backgroundImage =
    meta?.background || info?.image || info?.poster || routeParams.poster || '';

  const colors = useDetailSeedPalette(posterImage || backgroundImage);

  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);

  const displayTitle = meta?.name || info?.title || '';
  const displaySynopsis =
    meta?.description || info?.synopsis || 'No synopsis available';
  const displayRating = meta?.imdbRating || info?.rating || '';
  const displayYear = meta?.releaseInfo || meta?.year || '';
  const displayRuntime = meta?.runtime || '';
  const displayGenres: string[] =
    (Array.isArray(meta?.genres) && meta.genres.length > 0
      ? meta.genres
      : info?.tags) || [];
  const displayCast: string[] =
    (Array.isArray(meta?.cast) && meta.cast.length > 0
      ? meta.cast
      : info?.cast) || [];

  const inLibrary = watchList.some(item => item.link === routeParams.link);
  const savedItem = watchList.find(item => item.link === routeParams.link);

  const handleToggleLibrary = () => {
    if (inLibrary) {
      if (collections.length > 1) {
        setCollectionDialogOpen(true);
      } else {
        removeItem(routeParams.link);
      }
    } else {
      addItem({
        title: displayTitle || 'Untitled',
        poster: posterImage,
        link: routeParams.link,
        provider: activeProviderValue,
      });
    }
  };

  return (
    <div
      className="flex-1 min-h-screen overflow-y-auto pb-24 sm:pb-12 select-none"
      style={{backgroundColor: colors.background}}>
      {/* Top Header Bar */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between pointer-events-none">
        <button
          onClick={goBack}
          className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border pointer-events-auto cursor-pointer"
          style={{
            backgroundColor: 'rgba(28, 27, 31, 0.72)',
            borderColor: colors.outlineVariant,
            color: colors.onSurface,
          }}>
          <ArrowLeft size={20} />
        </button>

        {displayTitle && (
          <button
            onClick={() =>
              navigate({
                name: 'SearchResults',
                params: {filter: displayTitle},
              })
            }
            className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border pointer-events-auto cursor-pointer"
            style={{
              backgroundColor: 'rgba(28, 27, 31, 0.72)',
              borderColor: colors.outlineVariant,
              color: colors.onSurface,
            }}
            title="Search title across providers">
            <Search size={18} />
          </button>
        )}
      </div>

      {/* Hero Backdrop */}
      <div className="relative w-full h-[300px] -mt-16 overflow-hidden">
        {backgroundImage ? (
          <>
            <img
              src={backgroundImage}
              alt=""
              className="w-full h-full object-cover blur-xl scale-110 opacity-50"
            />
            <div className="absolute inset-0 flex items-center justify-center pt-10 pb-6">
              <img
                src={posterImage || backgroundImage}
                alt={displayTitle}
                className="h-full max-h-[210px] w-auto rounded-2xl object-cover shadow-2xl border border-white/10"
              />
            </div>
          </>
        ) : (
          <div
            className="w-full h-full"
            style={{backgroundColor: colors.surfaceContainerLow}}
          />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-32"
          style={{
            background: `linear-gradient(to top, ${colors.background} 10%, transparent 100%)`,
          }}
        />
      </div>

      {/* Content Overview Body */}
      <div className="max-w-4xl mx-auto px-4 -mt-2 relative z-10">
        {isLoading ? (
          <div className="space-y-4 animate-pulse py-4">
            <div
              className="h-8 w-2/3 rounded-lg"
              style={{backgroundColor: colors.surfaceContainerHighest}}
            />
            <div
              className="h-4 w-1/3 rounded"
              style={{backgroundColor: colors.surfaceContainerHigh}}
            />
            <div
              className="h-24 w-full rounded-2xl"
              style={{backgroundColor: colors.surfaceContainerLow}}
            />
          </div>
        ) : error ? (
          <div
            className="p-8 rounded-3xl border text-center my-6"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            }}>
            <AlertTriangle
              size={36}
              className="mx-auto mb-3"
              style={{color: colors.error}}
            />
            <h2
              className="text-lg font-bold mb-1"
              style={{color: colors.onSurface}}>
              Failed to load content details
            </h2>
            <p
              className="text-xs mb-5"
              style={{color: colors.onSurfaceVariant}}>
              {error instanceof Error ? error.message : 'Provider request failed'}
            </p>
            <button
              onClick={() => refetch()}
              className="px-5 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              style={{
                backgroundColor: colors.primary,
                color: colors.onPrimary,
              }}>
              <RefreshCw size={14} />
              <span>Try Again</span>
            </button>
          </div>
        ) : (
          <>
            {/* Title & Rating */}
            <div className="flex items-start justify-between gap-3 mb-2">
              {meta?.logo ? (
                <img
                  src={meta.logo}
                  alt={displayTitle}
                  className="h-14 max-w-[240px] object-contain"
                />
              ) : (
                <h1
                  className="text-2xl sm:text-3xl font-bold tracking-tight"
                  style={{color: colors.onSurface}}>
                  {displayTitle}
                </h1>
              )}

              {displayRating && (
                <div className="flex items-baseline shrink-0 pt-1">
                  <span
                    className="text-lg font-extrabold"
                    style={{color: m3SemanticColors.warning}}>
                    {displayRating}
                  </span>
                  <span
                    className="text-xs font-semibold ml-0.5"
                    style={{color: colors.onSurfaceVariant}}>
                    /10
                  </span>
                </div>
              )}
            </div>

            {/* Metadata Chips */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {info?.type && (
                <span
                  className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase"
                  style={{
                    backgroundColor: colors.primaryContainer,
                    color: colors.onPrimaryContainer,
                  }}>
                  {info.type}
                </span>
              )}
              {displayYear && (
                <span
                  className="px-2.5 py-0.5 rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: colors.surfaceContainerHigh,
                    color: colors.onSurfaceVariant,
                  }}>
                  {displayYear}
                </span>
              )}
              {displayRuntime && (
                <span
                  className="px-2.5 py-0.5 rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: colors.surfaceContainerHigh,
                    color: colors.onSurfaceVariant,
                  }}>
                  {displayRuntime}
                </span>
              )}
              {displayGenres.map((genre, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: colors.secondaryContainer,
                    color: colors.onSecondaryContainer,
                  }}>
                  {genre}
                </span>
              ))}
            </div>

            {/* Action Buttons Row (Search, Web, Explore, Save) */}
            <div className="grid grid-cols-4 gap-2 my-3">
              <button
                onClick={() =>
                  navigate({
                    name: 'SearchResults',
                    params: {filter: displayTitle},
                  })
                }
                className="py-2.5 px-2 rounded-xl flex flex-col items-center justify-center gap-1 border transition-colors hover:bg-white/5 cursor-pointer"
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                }}>
                <Search size={17} />
                <span className="text-[11px] font-semibold">Search</span>
              </button>

              <button
                onClick={() => {
                  if (routeParams.link.startsWith('http')) {
                    window.open(routeParams.link, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="py-2.5 px-2 rounded-xl flex flex-col items-center justify-center gap-1 border transition-colors hover:bg-white/5 cursor-pointer"
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                }}>
                <Globe size={17} />
                <span className="text-[11px] font-semibold">Web</span>
              </button>

              <button
                onClick={() => setStoryModalOpen(true)}
                className="py-2.5 px-2 rounded-xl flex flex-col items-center justify-center gap-1 border transition-colors hover:bg-white/5 cursor-pointer"
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                }}>
                <Sparkles size={17} />
                <span className="text-[11px] font-semibold">Explore</span>
              </button>

              <button
                onClick={handleToggleLibrary}
                onContextMenu={e => {
                  e.preventDefault();
                  setCollectionDialogOpen(true);
                }}
                className="py-2.5 px-2 rounded-xl flex flex-col items-center justify-center gap-1 border transition-colors cursor-pointer"
                style={{
                  backgroundColor: inLibrary
                    ? colors.secondaryContainer
                    : colors.surfaceContainerLow,
                  borderColor: inLibrary
                    ? colors.secondaryContainer
                    : colors.outlineVariant,
                  color: inLibrary
                    ? colors.onSecondaryContainer
                    : colors.onSurface,
                }}>
                {inLibrary ? <Check size={17} /> : <Bookmark size={17} />}
                <span className="text-[11px] font-semibold">
                  {inLibrary ? 'Saved' : 'Save'}
                </span>
              </button>
            </div>

            {/* Synopsis Box */}
            <div
              onClick={() => setSynopsisExpanded(prev => !prev)}
              className="p-4 rounded-2xl border my-3 cursor-pointer"
              style={{
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              }}>
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{color: colors.onSurface}}>
                  Synopsis
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold"
                  style={{
                    backgroundColor: colors.tertiaryContainer,
                    color: colors.onTertiaryContainer,
                  }}>
                  {matchedInstalled?.display_name || activeProviderValue}
                </span>
              </div>
              <p
                className={`text-xs sm:text-sm leading-relaxed ${
                  synopsisExpanded ? '' : 'line-clamp-3'
                }`}
                style={{color: colors.onSurfaceVariant}}>
                {displaySynopsis}
              </p>
              {displaySynopsis.length > 140 && (
                <span
                  className="inline-block mt-1.5 text-xs font-bold"
                  style={{color: colors.primary}}>
                  {synopsisExpanded ? 'Show less' : 'Read more'}
                </span>
              )}
            </div>

            {/* Cast list if present */}
            {displayCast.length > 0 && (
              <div className="my-2">
                <p
                  className="text-xs font-semibold mb-1.5"
                  style={{color: colors.onSurfaceVariant}}>
                  Cast: {displayCast.slice(0, 8).join(', ')}
                </p>
              </div>
            )}

            {/* SeasonList & Episodes */}
            <SeasonList
              LinkList={info?.linkList || []}
              poster={{
                logo: meta?.logo,
                poster: posterImage,
                background: backgroundImage,
              }}
              type={info?.type || 'movie'}
              metaTitle={displayTitle}
              providerValue={activeProviderValue}
              sourceAuthor={matchedInstalled?.source?.author}
              infoUrl={routeParams.link}
              imdbId={info?.imdbId}
              synopsis={displaySynopsis}
            />
          </>
        )}
      </div>

      {/* Explore Story Modal */}
      {storyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{backgroundColor: 'rgba(0,0,0,0.75)'}}
          onClick={() => setStoryModalOpen(false)}>
          <div
            className="w-full max-w-lg rounded-3xl p-6 border shadow-2xl"
            style={{
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
            }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-lg font-bold"
                style={{color: colors.onSurface}}>
                {displayTitle} — Overview
              </h3>
              <button
                onClick={() => setStoryModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
                style={{color: colors.onSurfaceVariant}}>
                <X size={18} />
              </button>
            </div>
            <p
              className="text-sm leading-relaxed mb-4 max-h-72 overflow-y-auto"
              style={{color: colors.onSurfaceVariant}}>
              {displaySynopsis}
            </p>
            {displayCast.length > 0 && (
              <div className="mb-3">
                <p
                  className="text-xs font-bold uppercase mb-1"
                  style={{color: colors.onSurface}}>
                  Cast
                </p>
                <p
                  className="text-xs"
                  style={{color: colors.onSurfaceVariant}}>
                  {displayCast.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Library Collection Picker Modal */}
      {collectionDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{backgroundColor: 'rgba(0,0,0,0.72)'}}
          onClick={() => setCollectionDialogOpen(false)}>
          <div
            className="w-full max-w-sm rounded-3xl p-6 border shadow-2xl"
            style={{
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
            }}
            onClick={e => e.stopPropagation()}>
            <h3
              className="text-lg font-bold mb-3"
              style={{color: colors.onSurface}}>
              Save to Categories
            </h3>
            <div className="space-y-2 mb-5">
              {collections.map(col => {
                const selectedIds = savedItem?.collections || [];
                const checked = selectedIds.includes(col.id);
                return (
                  <label
                    key={col.id}
                    className="flex items-center justify-between p-3 rounded-xl border cursor-pointer"
                    style={{
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                    }}>
                    <span
                      className="text-sm font-medium"
                      style={{color: colors.onSurface}}>
                      {col.name}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...selectedIds, col.id]
                          : selectedIds.filter(id => id !== col.id);
                        setItemCollections(
                          {
                            title: displayTitle || 'Untitled',
                            poster: posterImage,
                            link: routeParams.link,
                            provider: activeProviderValue,
                          },
                          next,
                        );
                      }}
                    />
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              {inLibrary && (
                <button
                  onClick={() => {
                    removeItem(routeParams.link);
                    setCollectionDialogOpen(false);
                  }}
                  className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                  style={{
                    backgroundColor: colors.errorContainer,
                    color: colors.onErrorContainer,
                  }}>
                  Remove from Library
                </button>
              )}
              <button
                onClick={() => setCollectionDialogOpen(false)}
                className="px-5 py-2 rounded-full text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
