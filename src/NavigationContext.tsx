import React, {createContext, useContext, useState, useCallback} from 'react';
import type {EpisodeLink, SkipInterval} from './lib/providers/types';

export type TabKey = 'Home' | 'Search' | 'Library' | 'Downloads' | 'Settings';

export interface InfoRouteParams {
  link: string;
  provider?: string;
  poster?: string;
}

export interface ScrollListRouteParams {
  filter: string;
  title?: string;
  providerValue?: string;
  isSearch: boolean;
}

export interface SearchResultsRouteParams {
  filter: string;
}

export interface PlayerRouteParams {
  linkList: EpisodeLink[];
  episodeIndex: number;
  type: string;
  primaryTitle?: string;
  secondaryTitle?: string;
  seasonTitle?: string;
  poster: {
    logo?: string;
    poster?: string;
    background?: string;
  };
  file?: string;
  providerValue?: string;
  sourceAuthor?: string;
  infoUrl?: string;
  imdbId?: string;
  synopsis?: string;
  skip?: SkipInterval[];
}

export type StackScreen =
  | {name: 'Tabs'}
  | {name: 'Info'; params: InfoRouteParams}
  | {name: 'ScrollList'; params: ScrollListRouteParams}
  | {name: 'SearchResults'; params: SearchResultsRouteParams}
  | {name: 'Player'; params: PlayerRouteParams}
  | {name: 'Extensions'}
  | {name: 'Appearance'}
  | {name: 'PlayerSettings'}
  | {name: 'SubtitleSettings'}
  | {name: 'Preferences'}
  | {name: 'About'};

interface NavigationContextValue {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  stack: StackScreen[];
  currentScreen: StackScreen;
  navigate: (screen: StackScreen) => void;
  goBack: () => void;
  popToTabs: (tab?: TabKey) => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const NavigationProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [activeTab, setActiveTabState] = useState<TabKey>('Home');
  const [stack, setStack] = useState<StackScreen[]>([{name: 'Tabs'}]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const navigate = useCallback((screen: StackScreen) => {
    setStack(prev => [...prev, screen]);
  }, []);

  const goBack = useCallback(() => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const popToTabs = useCallback((tab?: TabKey) => {
    if (tab) {
      setActiveTabState(tab);
    }
    setStack([{name: 'Tabs'}]);
  }, []);

  const setActiveTab = useCallback((tab: TabKey) => {
    setActiveTabState(tab);
    setStack([{name: 'Tabs'}]);
  }, []);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const currentScreen = stack[stack.length - 1] || {name: 'Tabs'};

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        stack,
        currentScreen,
        navigate,
        goBack,
        popToTabs,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
      }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useVegaNavigation = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useVegaNavigation must be used within NavigationProvider');
  }
  return ctx;
};
