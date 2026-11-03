import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {extensionStorage, ProviderExtension} from '../storage/extensionStorage';
import {settingsStorage} from '../storage/SettingsStorage';
import {createZustandStorage} from '../storage/StorageService';
import {sortInstalledProviders} from '../providerOrder';

export interface Content {
  provider: ProviderExtension;
  setProvider: (type: ProviderExtension) => void;
  installedProviders: ProviderExtension[];
  availableProviders: ProviderExtension[];
  setInstalledProviders: (providers: ProviderExtension[]) => void;
  setAvailableProviders: (providers: ProviderExtension[]) => void;
  activeExtensionProvider: ProviderExtension | null;
  setActiveExtensionProvider: (provider: ProviderExtension | null) => void;
}

const EMPTY_PROVIDER: ProviderExtension = {
  value: '',
  display_name: '',
  type: 'global',
  installed: false,
  disabled: false,
  version: '0.0.1',
  icon: '',
  source: {author: '', url: ''},
  installedAt: 0,
  lastUpdated: 0,
};

const useContentStore = create<Content>()(
  persist(
    set => {
      const initialInstalled = sortInstalledProviders(
        extensionStorage.getInstalledProviders(),
        settingsStorage.getProviderOrder(),
      );
      return {
        provider: initialInstalled[0] || EMPTY_PROVIDER,
        installedProviders: initialInstalled,
        availableProviders: [],
        activeExtensionProvider: initialInstalled[0] || null,

        setProvider: (provider: ProviderExtension) => set({provider}),

        setInstalledProviders: (providers: ProviderExtension[]) =>
          set(state => {
            const sorted = sortInstalledProviders(
              providers,
              settingsStorage.getProviderOrder(),
            );
            const activeStillExists = sorted.some(
              p =>
                p.value === state.provider.value &&
                (!state.provider.source?.author ||
                  p.source?.author === state.provider.source?.author),
            );
            return {
              installedProviders: sorted,
              provider: activeStillExists
                ? state.provider
                : sorted[0] || EMPTY_PROVIDER,
            };
          }),

        setAvailableProviders: (providers: ProviderExtension[]) =>
          set({availableProviders: providers}),

        setActiveExtensionProvider: (provider: ProviderExtension | null) =>
          set({activeExtensionProvider: provider}),
      };
    },
    {
      name: 'content-storage',
      storage: createJSONStorage(() => createZustandStorage()),
      partialize: state => ({
        provider: state.provider,
        activeExtensionProvider: state.activeExtensionProvider,
      }),
    },
  ),
);

export default useContentStore;
