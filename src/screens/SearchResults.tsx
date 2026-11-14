import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {ArrowLeft, RefreshCw, ChevronDown, ChevronUp} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation, SearchResultsRouteParams} from '../NavigationContext';
import useContentStore from '../lib/zustand/contentStore';
import {providerManager} from '../lib/services/ProviderManager';
import {ProviderExtension} from '../lib/storage';
import {Post} from '../lib/providers/types';
import {Slider} from '../components/Slider';

interface ProviderSearchState {
  posts: Post[];
  loading: boolean;
  error: boolean;
}

export const SearchResults: React.FC<{
  routeParams: SearchResultsRouteParams;
}> = ({routeParams}) => {
  const colors = useM3Colors();
  const {goBack} = useVegaNavigation();
  const {installedProviders, provider: activeProvider} = useContentStore();

  const orderedProviders = useMemo(() => {
    if (!installedProviders?.length) return [];
    const active = installedProviders.filter(
      item => item.value === activeProvider?.value,
    );
    const rest = installedProviders.filter(
      item => item.value !== activeProvider?.value,
    );
    return [...active, ...rest];
  }, [installedProviders, activeProvider?.value]);

  const [resultsByProvider, setResultsByProvider] = useState<
    Record<string, ProviderSearchState>
  >({});
  const [showEmpty, setShowEmpty] = useState(false);
  const controllersRef = useRef<Record<string, AbortController>>({});

  const runProviderSearch = useCallback(
    async (item: ProviderExtension) => {
      controllersRef.current[item.value]?.abort();
      const controller = new AbortController();
      controllersRef.current[item.value] = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 24000);

      setResultsByProvider(prev => ({
        ...prev,
        [item.value]: {
          posts: prev[item.value]?.posts ?? [],
          loading: true,
          error: false,
        },
      }));

      try {
        const data = await providerManager.getSearchPosts({
          searchQuery: routeParams.filter,
          page: 1,
          providerValue: item.value,
          sourceAuthor: item.source?.author,
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);
        if (controller.signal.aborted) return;
        setResultsByProvider(prev => ({
          ...prev,
          [item.value]: {
            posts: Array.isArray(data) ? data : [],
            loading: false,
            error: false,
          },
        }));
      } catch {
        window.clearTimeout(timeoutId);
        if (controllersRef.current[item.value] !== controller) return;
        setResultsByProvider(prev => ({
          ...prev,
          [item.value]: {
            posts: [],
            loading: false,
            error: true,
          },
        }));
      }
    },
    [routeParams.filter],
  );

  useEffect(() => {
    setResultsByProvider({});
    setShowEmpty(false);
    if (orderedProviders.length === 0) return;

    let cancelled = false;
    const concurrency = 6;
    let nextIdx = 0;

    const workers = Array.from(
      {length: Math.min(concurrency, orderedProviders.length)},
      async () => {
        while (!cancelled && nextIdx < orderedProviders.length) {
          const item = orderedProviders[nextIdx++];
          await runProviderSearch(item);
        }
      },
    );

    Promise.all(workers);

    return () => {
      cancelled = true;
      Object.values(controllersRef.current).forEach(c => c.abort());
      controllersRef.current = {};
    };
  }, [orderedProviders, runProviderSearch]);

  const {visibleProviders, emptyProviders, erroredProviders, completedCount} =
    useMemo(() => {
      const visible: ProviderExtension[] = [];
      const empty: ProviderExtension[] = [];
      const errored: ProviderExtension[] = [];
      let completed = 0;

      for (const item of orderedProviders) {
        const state = resultsByProvider[item.value];
        if (state && !state.loading) {
          completed++;
        }
        if (!state || state.loading || state.posts.length > 0) {
          visible.push(item);
        } else {
          empty.push(item);
          if (state.error) {
            errored.push(item);
          }
        }
      }
      return {
        visibleProviders: visible,
        emptyProviders: empty,
        erroredProviders: errored,
        completedCount: completed,
      };
    }, [orderedProviders, resultsByProvider]);

  const providersToRender = showEmpty
    ? [...visibleProviders, ...emptyProviders]
    : visibleProviders;

  return (
    <div
      className="flex-1 min-h-screen pb-24 sm:pb-12 overflow-y-auto select-none"
      style={{backgroundColor: colors.background}}>
      {/* Header */}
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
            <p
              className="text-[11px] uppercase tracking-wider font-semibold"
              style={{color: colors.onSurfaceVariant}}>
              {orderedProviders.length > 0 &&
              completedCount < orderedProviders.length
                ? `Searching (${completedCount}/${orderedProviders.length})`
                : 'Search Results'}
            </p>
            <h1
              className="text-lg font-bold truncate"
              style={{color: colors.onSurface}}>
              "{routeParams.filter}"
            </h1>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="pt-2 space-y-2">
        {erroredProviders.length > 0 && (
          <div className="px-4 pt-1 pb-2 flex items-center gap-2">
            <button
              onClick={() =>
                erroredProviders.forEach(p => runProviderSearch(p))
              }
              className="px-4 py-2 rounded-full flex items-center gap-2 text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: colors.surfaceContainerHigh,
                color: colors.onSurface,
              }}>
              <RefreshCw size={13} />
              <span>Retry failed ({erroredProviders.length})</span>
            </button>
          </div>
        )}
        {orderedProviders.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-sm" style={{color: colors.onSurfaceVariant}}>
              No providers installed. Install a provider in Settings → Provider
              Manager to search.
            </p>
          </div>
        ) : (
          providersToRender.map(item => {
            const state = resultsByProvider[item.value];
            return (
              <Slider
                key={item.value}
                title={item.display_name}
                posts={state?.posts ?? []}
                filter={routeParams.filter}
                providerValue={item.value}
                isLoading={state ? state.loading : true}
                isSearch={true}
              />
            );
          })
        )}

        {/* Empty / Failed Providers Footer */}
        {emptyProviders.length > 0 && (
          <div className="px-4 py-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => setShowEmpty(prev => !prev)}
              className="px-4 py-2 rounded-full border flex items-center gap-2 text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
                color: colors.onSurfaceVariant,
              }}>
              {showEmpty ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              <span>
                {showEmpty
                  ? 'Hide empty results'
                  : `Show empty results (${emptyProviders.length})`}
              </span>
            </button>

            {erroredProviders.length > 0 && (
              <button
                onClick={() =>
                  erroredProviders.forEach(p => runProviderSearch(p))
                }
                className="px-4 py-2 rounded-full flex items-center gap-2 text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: colors.secondaryContainer,
                  color: colors.onSecondaryContainer,
                }}>
                <RefreshCw size={14} />
                <span>Retry failed ({erroredProviders.length})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
