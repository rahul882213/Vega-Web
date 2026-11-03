import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {settingsStorage, createZustandStorage} from '../storage';

export type AccentSource = 'wallpaper' | 'custom';

export interface Theme {
  primary: string;
  isCustom: boolean;
  source: AccentSource;
  setPrimary: (type: Theme['primary']) => void;
  setCustom: (isCustom: boolean) => void;
  setSource: (source: AccentSource) => void;
}

const useThemeStore = create<Theme>()(
  persist(
    set => ({
      primary: settingsStorage.getPrimaryColor(),
      isCustom: settingsStorage.isCustomTheme(),
      source: settingsStorage.getAccentSource(),

      setPrimary: (primary: Theme['primary']) => {
        set({primary});
        settingsStorage.setPrimaryColor(primary);
      },
      setCustom: (isCustom: Theme['isCustom']) => {
        set({isCustom});
        settingsStorage.setCustomTheme(isCustom);
      },
      setSource: (source: AccentSource) => {
        set({source});
        settingsStorage.setAccentSource(source);
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => createZustandStorage()),
    },
  ),
);

export default useThemeStore;
