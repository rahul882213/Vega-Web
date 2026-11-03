export interface M3Palette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  scrim: string;
  shadow: string;
  elevation: {
    level0: string;
    level1: string;
    level2: string;
    level3: string;
    level4: string;
    level5: string;
  };
  surfaceDisabled: string;
  onSurfaceDisabled: string;
  backdrop: string;
  surfaceTint: string;
}

export const defaultM3DarkPalette: M3Palette = {
  primary: '#FFFFFF',
  onPrimary: '#1A1A1A',
  primaryContainer: '#3A3A3A',
  onPrimaryContainer: '#F5F5F5',
  secondary: '#CCCCCC',
  onSecondary: '#262626',
  secondaryContainer: '#3D3D3D',
  onSecondaryContainer: '#E6E6E6',
  tertiary: '#B8B8B8',
  onTertiary: '#262626',
  tertiaryContainer: '#383838',
  onTertiaryContainer: '#E0E0E0',
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  background: '#171717',
  onBackground: '#E6E1E5',
  surface: '#171717',
  surfaceDim: '#121212',
  surfaceBright: '#36343B',
  surfaceContainerLowest: '#0D0D0D',
  surfaceContainerLow: '#1C1B1F',
  surfaceContainer: '#1E1E1E',
  surfaceContainerHigh: '#262626',
  surfaceContainerHighest: '#333333',
  onSurface: '#E6E1E5',
  surfaceVariant: '#49454F',
  onSurfaceVariant: '#CAC4D0',
  outline: '#938F99',
  outlineVariant: '#49454F',
  inverseSurface: '#E6E1E5',
  inverseOnSurface: '#313033',
  inversePrimary: '#404040',
  scrim: '#000000',
  shadow: '#000000',
  elevation: {
    level0: 'transparent',
    level1: '#1C1B1F',
    level2: '#1E1E1E',
    level3: '#262626',
    level4: '#2B2930',
    level5: '#333333',
  },
  surfaceDisabled: 'rgba(230, 225, 229, 0.12)',
  onSurfaceDisabled: 'rgba(230, 225, 229, 0.38)',
  backdrop: 'rgba(0, 0, 0, 0.5)',
  surfaceTint: '#FFFFFF',
};

export const m3SemanticColors = {
  warning: '#F59E0B',
  success: '#22C55E',
  info: '#3B82F6',
  imdbBadge: '#F5C518',
  imdbBadgeText: '#000000',
} as const;
