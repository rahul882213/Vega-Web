import React, {useState, useEffect} from 'react';
import {ArrowLeft, LayoutGrid, List} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation, ScrollListRouteParams} from '../NavigationContext';
import useContentStore from '../lib/zustand/contentStore';
import {providerManager} from '../lib/services/ProviderManager';
import {settingsStorage} from '../lib/storage';
import {Post} from '../lib/providers/types';

export const ScrollList: React.FC<{routeParams: ScrollListRouteParams}> = ({
  routeParams,
}) => {
  const colors = useM3Colors();
  const {goBack, navigate} = useVegaNavigation();
  const {provider, installedProviders} = useContentStore();

  const targetProviderValue = routeParams.providerValue || provider.value;
  const matchedInstalled = installedProviders.find(
    p => p.value === targetProviderValue,
  );

  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [viewType, setViewType] = useState<number>(() =>
    settingsStorage.getListViewType(),
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchPage() {
      setIsLoading(true);
      try {
        const data = routeParams.isSearch
          ? await providerManager.getSearchPosts({
              searchQuery: routeParams.filter,
              page,
              providerValue: targetProviderValue,
              sourceAuthor: matchedInstalled?.source?.author,
              signal: controller.signal,
            })
          : await providerManager.getPosts({
              filter: routeParams.filter,
              page,
              providerValue: targetProviderValue,
              sourceAuthor: matchedInstalled?.source?.author,
              signal: controller.signal,
            });

        if (cancelled) return;

        if (!data || data.length === 0) {
          setHasMore(false);
        } else {
          setPosts(prev => (page === 1 ? data : [...prev, ...data]));
        }
      } catch {
        if (!cancelled) {
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPage();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    page,
    routeParams.filter,
    routeParams.isSearch,
    targetProviderValue,
    matchedInstalled?.source?.author,
  ]);

  const toggleViewType = () => {
    const next = viewType === 1 ? 2 : 1;
    setViewType(next);
    settingsStorage.setListViewType(next);
  };

  return (
    <div
      className="flex-1 min-h-screen flex flex-col pb-24 sm:pb-12 select-none"
      style={{backgroundColor: colors.background}}>
      {/* Top Bar */}
      <div
        className="sticky top-0 z-20 px-4 py-3.5 border-b flex items-center justify-between gap-3"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.outlineVariant,
        }}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={goBack}
            className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            style={{color: colors.onSurface}}>
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1
              className="text-lg font-bold truncate"
              style={{color: colors.onSurface}}>
              {routeParams.title || routeParams.filter}
            </h1>
            <p
              className="text-xs truncate"
              style={{color: colors.onSurfaceVariant}}>
              {matchedInstalled?.display_name || targetProviderValue}
            </p>
          </div>
        </div>

        <button
          onClick={toggleViewType}
          className="p-2.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          style={{color: colors.onSurfaceVariant}}
          title="Toggle grid/list view">
          {viewType === 1 ? <List size={20} /> : <LayoutGrid size={20} />}
        </button>
      </div>

      {/* Content Grid or List */}
      <div className="flex-1 px-4 pt-4">
        {viewType === 1 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5">
            {posts.map((item, idx) => (
              <button
                key={`${item.link}-${idx}`}
                onClick={() =>
                  navigate({
                    name: 'Info',
                    params: {
                      link: item.link,
                      provider: targetProviderValue,
                      poster: item.image,
                    },
                  })
                }
                className="text-left group cursor-pointer">
                <div
                  className="aspect-[2/3] w-full rounded-xl overflow-hidden border transition-transform group-hover:scale-[1.02]"
                  style={{
                    backgroundColor: colors.surfaceContainerHigh,
                    borderColor: 'rgba(255,255,255,0.06)',
                  }}>
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 text-xs text-center opacity-50">
                      {item.title}
                    </div>
                  )}
                </div>
                <p
                  className="text-xs font-medium mt-1.5 line-clamp-2"
                  style={{color: colors.onSurface}}>
                  {item.title}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5 max-w-3xl">
            {posts.map((item, idx) => (
              <button
                key={`${item.link}-${idx}`}
                onClick={() =>
                  navigate({
                    name: 'Info',
                    params: {
                      link: item.link,
                      provider: targetProviderValue,
                      poster: item.image,
                    },
                  })
                }
                className="w-full flex items-center gap-3.5 p-2.5 rounded-2xl border text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                }}>
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-16 h-24 rounded-xl object-cover shrink-0 bg-black/30"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold line-clamp-2"
                    style={{color: colors.onSurface}}>
                    {item.title}
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{color: colors.onSurfaceVariant}}>
                    {matchedInstalled?.display_name || targetProviderValue}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="py-8 flex justify-center">
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{borderColor: colors.primary, borderTopColor: 'transparent'}}
            />
          </div>
        )}

        {!isLoading && hasMore && posts.length > 0 && (
          <div className="py-6 flex justify-center">
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-6 py-2.5 rounded-full text-xs font-bold cursor-pointer"
              style={{
                backgroundColor: colors.secondaryContainer,
                color: colors.onSecondaryContainer,
              }}>
              Load more
            </button>
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm" style={{color: colors.onSurfaceVariant}}>
              No results found
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
