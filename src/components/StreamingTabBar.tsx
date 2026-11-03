import React from 'react';
import {Home, Search, Bookmark, Download, Settings} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation, TabKey} from '../NavigationContext';
import useNavigationPreferencesStore from '../lib/zustand/navigationPreferencesStore';
import {settingsStorage} from '../lib/storage';

interface TabItem {
  key: TabKey;
  label: string;
  icon: React.FC<{size?: number; strokeWidth?: number; className?: string}>;
}

const ALL_TABS: TabItem[] = [
  {key: 'Home', label: 'Home', icon: Home},
  {key: 'Search', label: 'Search', icon: Search},
  {key: 'Library', label: 'Library', icon: Bookmark},
  {key: 'Downloads', label: 'Downloads', icon: Download},
  {key: 'Settings', label: 'Settings', icon: Settings},
];

export const StreamingTabBar: React.FC = () => {
  const colors = useM3Colors();
  const {activeTab, setActiveTab} = useVegaNavigation();
  const hideDownloadsTab = useNavigationPreferencesStore(
    state => state.hideDownloadsTab,
  );
  const showLabels = settingsStorage.showTabBarLabels();

  const visibleTabs = ALL_TABS.filter(
    t => !(hideDownloadsTab && t.key === 'Downloads'),
  );

  return (
    <>
      {/* Desktop / Tablet Left Navigation Rail (>= 640px) */}
      <aside
        className="hidden sm:flex flex-col items-center justify-center w-24 shrink-0 border-r select-none z-30"
        style={{
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
        }}>
        <div className="flex flex-col items-center gap-3 w-full px-2">
          {visibleTabs.map(tab => {
            const isFocused = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex flex-col items-center justify-center w-full py-2 rounded-2xl transition-colors cursor-pointer group"
                style={{
                  color: isFocused ? colors.onSecondaryContainer : colors.onSurfaceVariant,
                }}>
                <div
                  className="flex items-center justify-center w-14 h-8 rounded-full transition-all"
                  style={{
                    backgroundColor: isFocused
                      ? colors.secondaryContainer
                      : 'transparent',
                  }}>
                  <Icon
                    size={20}
                    strokeWidth={isFocused ? 2.4 : 1.9}
                  />
                </div>
                {showLabels && (
                  <span
                    className="text-[11px] mt-1 tracking-tight transition-colors"
                    style={{
                      fontWeight: isFocused ? 700 : 500,
                      color: isFocused ? colors.onSurface : colors.onSurfaceVariant,
                    }}>
                    {tab.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (< 640px) */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t px-1 py-1.5 select-none"
        style={{
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
        }}>
        {visibleTabs.map(tab => {
          const isFocused = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex flex-col items-center justify-center flex-1 py-1 cursor-pointer">
              <div
                className="flex items-center justify-center w-16 h-8 rounded-full transition-all"
                style={{
                  backgroundColor: isFocused
                    ? colors.secondaryContainer
                    : 'transparent',
                  color: isFocused
                    ? colors.onSecondaryContainer
                    : colors.onSurfaceVariant,
                }}>
                <Icon size={20} strokeWidth={isFocused ? 2.4 : 1.9} />
              </div>
              {showLabels && (
                <span
                  className="text-[11px] mt-0.5"
                  style={{
                    fontWeight: isFocused ? 700 : 500,
                    color: isFocused ? colors.onSurface : colors.onSurfaceVariant,
                  }}>
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
