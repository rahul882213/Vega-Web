import React, {useEffect} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {M3ThemeProvider, useM3Colors} from './theme/M3PaletteContext';
import {NavigationProvider, useVegaNavigation} from './NavigationContext';
import {StreamingTabBar} from './components/StreamingTabBar';
import {ProviderDrawer} from './components/ProviderDrawer';
import {GlobalAppDialogHost} from './components/AppDialog';
import {WebViewModal} from './components/WebViewModal';
import {Home} from './screens/Home';
import {Search} from './screens/Search';
import {Library} from './screens/Library';
import {Downloads} from './screens/Downloads';
import {Settings} from './screens/Settings';
import {Info} from './screens/Info';
import {ScrollList} from './screens/ScrollList';
import {SearchResults} from './screens/SearchResults';
import {Player} from './screens/Player';
import {Extensions} from './screens/Extensions';
import {
  AppearanceScreen,
  PlayerSettingsScreen,
  SubtitleSettingsScreen,
  PreferencesScreen,
  AboutScreen,
} from './screens/SubSettings';
import {extensionManager} from './lib/services/ExtensionManager';
import {
  extensionStorage,
  isSameSource,
  ProviderExtension,
} from './lib/storage/extensionStorage';
import useContentStore from './lib/zustand/contentStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

const VegaShell: React.FC = () => {
  const colors = useM3Colors();
  const {activeTab, currentScreen} = useVegaNavigation();
  const {setInstalledProviders, setAvailableProviders} = useContentStore();

  useEffect(() => {
    const initializeExtensions = async () => {
      try {
        await extensionManager.initialize();
        const installed = extensionStorage.getInstalledProviders();
        setInstalledProviders(installed);

        const sources = extensionStorage.getProviderSources();
        const mergedAvailable: ProviderExtension[] = [];
        for (const src of sources) {
          const cached = extensionStorage.getAvailableProviders(src.author);
          for (const item of cached) {
            if (
              !mergedAvailable.some(
                m =>
                  m.value === item.value && isSameSource(m.source, item.source),
              )
            ) {
              mergedAvailable.push(item);
            }
          }
        }
        setAvailableProviders(mergedAvailable);

        // Background auto-update for outdated installed provider modules
        extensionManager
          .autoUpdateInstalledProviders()
          .then(updated => {
            if (updated) {
              setInstalledProviders(extensionStorage.getInstalledProviders());
            }
          })
          .catch(() => {});
      } catch (error) {
        console.error('Failed to initialize Vega extensions:', error);
      }
    };

    initializeExtensions();
  }, [setInstalledProviders, setAvailableProviders]);

  const renderMainContent = () => {
    if (currentScreen.name === 'Player') {
      return <Player routeParams={currentScreen.params} />;
    }
    if (currentScreen.name === 'Info') {
      return <Info routeParams={currentScreen.params} />;
    }
    if (currentScreen.name === 'ScrollList') {
      return <ScrollList routeParams={currentScreen.params} />;
    }
    if (currentScreen.name === 'SearchResults') {
      return <SearchResults routeParams={currentScreen.params} />;
    }
    if (currentScreen.name === 'Extensions') {
      return <Extensions />;
    }
    if (currentScreen.name === 'Appearance') {
      return <AppearanceScreen />;
    }
    if (currentScreen.name === 'PlayerSettings') {
      return <PlayerSettingsScreen />;
    }
    if (currentScreen.name === 'SubtitleSettings') {
      return <SubtitleSettingsScreen />;
    }
    if (currentScreen.name === 'Preferences') {
      return <PreferencesScreen />;
    }
    if (currentScreen.name === 'About') {
      return <AboutScreen />;
    }

    // Default Tabs view
    switch (activeTab) {
      case 'Home':
        return <Home />;
      case 'Search':
        return <Search />;
      case 'Library':
        return <Library />;
      case 'Downloads':
        return <Downloads />;
      case 'Settings':
        return <Settings />;
      default:
        return <Home />;
    }
  };

  const isPlayerActive = currentScreen.name === 'Player';

  return (
    <div
      className="flex min-h-screen w-full"
      style={{backgroundColor: colors.background, color: colors.onSurface}}>
      {!isPlayerActive && <StreamingTabBar />}
      <main className="flex-1 min-w-0 flex flex-col">
        {renderMainContent()}
      </main>
      <ProviderDrawer />
      <GlobalAppDialogHost />
      <WebViewModal />
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <M3ThemeProvider>
        <NavigationProvider>
          <VegaShell />
        </NavigationProvider>
      </M3ThemeProvider>
    </QueryClientProvider>
  );
}
