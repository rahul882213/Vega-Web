import React, {useEffect} from 'react';
import {RefreshCw} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import useContentStore from '../lib/zustand/contentStore';
import useHeroStore from '../lib/zustand/herostore';
import useNavigationPreferencesStore from '../lib/zustand/navigationPreferencesStore';
import {useHomePageData} from '../lib/hooks/useHomePageData';
import {Hero} from '../components/Hero';
import {ContinueWatching} from '../components/ContinueWatching';
import {Slider} from '../components/Slider';
import {Tutorial} from '../components/Tutorial';

export const Home: React.FC = () => {
  const colors = useM3Colors();
  const {provider, installedProviders} = useContentStore();
  const {setHeroes} = useHeroStore();
  const showContinueWatching = useNavigationPreferencesStore(
    state => state.showContinueWatching,
  );

  const hasInstalledProviders =
    installedProviders && installedProviders.length > 0 && !!provider?.value;

  const {
    categories,
    heroPosts,
    isLoading,
    isRefetching,
    refetch,
  } = useHomePageData({
    provider,
    enabled: hasInstalledProviders,
  });

  useEffect(() => {
    setHeroes(heroPosts);
  }, [heroPosts, setHeroes]);

  if (!hasInstalledProviders) {
    return <Tutorial />;
  }

  const skeletonCatalog =
    categories.length > 0
      ? categories
      : [
          {title: 'Trending', Posts: [], filter: 'trending'},
          {title: 'Latest Releases', Posts: [], filter: 'latest'},
          {title: 'Popular', Posts: [], filter: 'popular'},
        ];

  return (
    <div
      className="flex-1 min-h-screen pb-24 sm:pb-12 overflow-y-auto"
      style={{backgroundColor: colors.background}}>
      <Hero isLoading={isLoading} />

      {/* Active Provider Pill & Refresh Button */}
      <div className="px-4 pt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full border"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
              color: colors.onSurfaceVariant,
            }}>
            Source: <strong style={{color: colors.onSurface}}>{provider.display_name}</strong>
          </span>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-medium hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
          style={{color: colors.onSurfaceVariant}}>
          <RefreshCw
            size={13}
            className={isLoading || isRefetching ? 'animate-spin' : ''}
          />
          <span>Refresh</span>
        </button>
      </div>

      {showContinueWatching && <ContinueWatching />}

      <div className="mt-1 space-y-1">
        {(isLoading ? skeletonCatalog : categories).map((item, index) => (
          <Slider
            key={`${item.filter}-${index}`}
            title={item.title}
            posts={item.Posts}
            filter={item.filter}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
};
