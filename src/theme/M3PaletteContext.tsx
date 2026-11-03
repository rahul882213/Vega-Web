import React, {createContext, useContext, useMemo} from 'react';
import {defaultM3DarkPalette, type M3Palette} from './colors';
import {findCuratedSeed} from './seeds';
import useThemeStore from '../lib/zustand/themeStore';

const M3PaletteContext = createContext<M3Palette>(defaultM3DarkPalette);

export const M3ThemeProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const primary = useThemeStore(state => state.primary);

  const palette = useMemo<M3Palette>(() => {
    const curated = findCuratedSeed(primary);
    return curated.dark;
  }, [primary]);

  return (
    <M3PaletteContext.Provider value={palette}>
      {children}
    </M3PaletteContext.Provider>
  );
};

export const useM3Colors = (): M3Palette => useContext(M3PaletteContext);
export {M3PaletteContext};
