import type {M3Palette} from './colors';

export interface CuratedSeed {
  id: 'white' | 'tomato' | 'gray' | 'blue' | 'lavender';
  name: string;
  seed: string;
  dark: M3Palette;
}

const NEUTRAL = {
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
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  inverseSurface: '#E6E1E5',
  inverseOnSurface: '#313033',
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
} as const;

export const CURATED_SEEDS: readonly CuratedSeed[] = [
  {
    id: 'white',
    name: 'White',
    seed: '#FFFFFF',
    dark: {
      ...NEUTRAL,
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
      inversePrimary: '#404040',
      surfaceTint: '#FFFFFF',
    },
  },
  {
    id: 'tomato',
    name: 'Tomato',
    seed: '#FF6347',
    dark: {
      ...NEUTRAL,
      primary: '#FFB4A4',
      onPrimary: '#561E13',
      primaryContainer: '#733427',
      onPrimaryContainer: '#FFDAD2',
      secondary: '#E7BDB4',
      onSecondary: '#442924',
      secondaryContainer: '#5D3F39',
      onSecondaryContainer: '#FFDAD2',
      tertiary: '#DEC38C',
      onTertiary: '#3E2E04',
      tertiaryContainer: '#564419',
      onTertiaryContainer: '#FBDFA6',
      inversePrimary: '#904B3D',
      surfaceTint: '#FFB4A4',
    },
  },
  {
    id: 'gray',
    name: 'Gray',
    seed: '#9E9E9E',
    dark: {
      ...NEUTRAL,
      primary: '#C8C6C8',
      onPrimary: '#303032',
      primaryContainer: '#474648',
      onPrimaryContainer: '#E4E1E4',
      secondary: '#C8C5CA',
      onSecondary: '#303034',
      secondaryContainer: '#47464A',
      onSecondaryContainer: '#E4E1E6',
      tertiary: '#CCC4CE',
      onTertiary: '#342F36',
      tertiaryContainer: '#4B454D',
      onTertiaryContainer: '#E8E0EB',
      inversePrimary: '#5F5E60',
      surfaceTint: '#C8C6C8',
    },
  },
  {
    id: 'blue',
    name: 'Blue',
    seed: '#2196F3',
    dark: {
      ...NEUTRAL,
      primary: '#9ECAFF',
      onPrimary: '#003258',
      primaryContainer: '#00497D',
      onPrimaryContainer: '#D1E4FF',
      secondary: '#BBC7DB',
      onSecondary: '#253140',
      secondaryContainer: '#3B4858',
      onSecondaryContainer: '#D7E3F7',
      tertiary: '#D6BEE4',
      onTertiary: '#3B2948',
      tertiaryContainer: '#523F5F',
      onTertiaryContainer: '#F2DAFF',
      inversePrimary: '#0061A4',
      surfaceTint: '#9ECAFF',
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    seed: '#B2A4D4',
    dark: {
      ...NEUTRAL,
      primary: '#CFBCFF',
      onPrimary: '#381E72',
      primaryContainer: '#4F378A',
      onPrimaryContainer: '#EADDFF',
      secondary: '#CBC2DB',
      onSecondary: '#332D41',
      secondaryContainer: '#4A4458',
      onSecondaryContainer: '#E8DEF8',
      tertiary: '#EFB8C8',
      onTertiary: '#492532',
      tertiaryContainer: '#633B48',
      onTertiaryContainer: '#FFD8E4',
      inversePrimary: '#6750A4',
      surfaceTint: '#CFBCFF',
    },
  },
];

export const DEFAULT_SEED: CuratedSeed = CURATED_SEEDS[0];

export function findCuratedSeed(seedOrId?: string | null): CuratedSeed {
  if (!seedOrId) {
    return DEFAULT_SEED;
  }
  const normalized = seedOrId.trim().toLowerCase();
  const match = CURATED_SEEDS.find(
    entry =>
      entry.id === normalized || entry.seed.toLowerCase() === normalized,
  );
  return match ?? DEFAULT_SEED;
}
