import React, {useState} from 'react';
import {ArrowLeft, Check, ExternalLink} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {CURATED_SEEDS} from '../theme/seeds';
import {useVegaNavigation} from '../NavigationContext';
import useThemeStore from '../lib/zustand/themeStore';
import useNavigationPreferencesStore from '../lib/zustand/navigationPreferencesStore';
import {
  settingsStorage,
  SEEK_INTERVAL_OPTIONS,
  PLAYBACK_SPEEDS,
  PLAYER_RESIZE_MODES,
} from '../lib/storage';

const Header: React.FC<{title: string}> = ({title}) => {
  const colors = useM3Colors();
  const {goBack} = useVegaNavigation();
  return (
    <div
      className="sticky top-0 z-20 px-4 py-3.5 border-b flex items-center gap-3"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.outlineVariant,
      }}>
      <button
        onClick={goBack}
        className="p-2 rounded-full hover:bg-white/10 cursor-pointer"
        style={{color: colors.onSurface}}>
        <ArrowLeft size={20} />
      </button>
      <h1
        className="text-lg font-bold tracking-tight"
        style={{color: colors.onSurface}}>
        {title}
      </h1>
    </div>
  );
};

export const AppearanceScreen: React.FC = () => {
  const colors = useM3Colors();
  const {primary, setPrimary} = useThemeStore();
  const [dynamicAccent, setDynamicAccent] = useState(() =>
    settingsStorage.isDynamicInfoAccentEnabled(),
  );
  const [showTabLabels, setShowTabLabels] = useState(() =>
    settingsStorage.showTabBarLabels(),
  );

  return (
    <div
      className="flex-1 min-h-screen pb-24 sm:pb-12 overflow-y-auto select-none"
      style={{backgroundColor: colors.background}}>
      <Header title="Appearance" />
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        <div
          className="p-4 rounded-2xl border"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <p
            className="text-sm font-bold mb-1"
            style={{color: colors.onSurface}}>
            Material 3 Theme Palette
          </p>
          <p
            className="text-xs mb-4"
            style={{color: colors.onSurfaceVariant}}>
            Choose one of Vega's curated Material 3 dark seed palettes
          </p>
          <div className="grid grid-cols-5 gap-3">
            {CURATED_SEEDS.map(seed => {
              const selected =
                primary.toLowerCase() === seed.seed.toLowerCase() ||
                primary.toLowerCase() === seed.id;
              return (
                <button
                  key={seed.id}
                  onClick={() => setPrimary(seed.seed)}
                  className="p-3 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer"
                  style={{
                    backgroundColor: selected
                      ? colors.secondaryContainer
                      : colors.surfaceContainerHigh,
                    borderColor: selected
                      ? colors.primary
                      : colors.outlineVariant,
                  }}>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center border border-white/20"
                    style={{backgroundColor: seed.seed}}>
                    {selected && <Check size={15} className="text-black" />}
                  </div>
                  <span
                    className="text-xs font-semibold"
                    style={{color: colors.onSurface}}>
                    {seed.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border space-y-4"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p
                className="text-sm font-semibold"
                style={{color: colors.onSurface}}>
                Dynamic Info Page Accent
              </p>
              <p
                className="text-xs"
                style={{color: colors.onSurfaceVariant}}>
                Extract accent colors from movie/series poster on detail screen
              </p>
            </div>
            <input
              type="checkbox"
              checked={dynamicAccent}
              onChange={e => {
                setDynamicAccent(e.target.checked);
                settingsStorage.setDynamicInfoAccentEnabled(e.target.checked);
              }}
              className="w-4 h-4 accent-white"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p
                className="text-sm font-semibold"
                style={{color: colors.onSurface}}>
                Show Navigation Tab Labels
              </p>
              <p
                className="text-xs"
                style={{color: colors.onSurfaceVariant}}>
                Display labels under navigation icons
              </p>
            </div>
            <input
              type="checkbox"
              checked={showTabLabels}
              onChange={e => {
                setShowTabLabels(e.target.checked);
                settingsStorage.setShowTabBarLabels(e.target.checked);
              }}
              className="w-4 h-4 accent-white"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export const PlayerSettingsScreen: React.FC = () => {
  const colors = useM3Colors();
  const [seekInterval, setSeekInterval] = useState(() =>
    settingsStorage.getSeekInterval(),
  );
  const [defaultSpeed, setDefaultSpeed] = useState(() =>
    settingsStorage.getPlaybackSpeed(),
  );
  const [resizeMode, setResizeMode] = useState(() =>
    settingsStorage.getDefaultResizeMode(),
  );
  const [autoPlayNext, setAutoPlayNext] = useState(() =>
    settingsStorage.isAutoPlayNextEpisodeEnabled(),
  );
  const [hideSeekBtns, setHideSeekBtns] = useState(() =>
    settingsStorage.hideSeekButtons(),
  );
  const [excludedQualities, setExcludedQualities] = useState<string[]>(() =>
    settingsStorage.getExcludedQualities(),
  );

  const toggleExcludedQuality = (q: string) => {
    const next = excludedQualities.includes(q)
      ? excludedQualities.filter(x => x !== q)
      : [...excludedQualities, q];
    setExcludedQualities(next);
    settingsStorage.setExcludedQualities(next);
  };

  return (
    <div
      className="flex-1 min-h-screen pb-24 sm:pb-12 overflow-y-auto select-none"
      style={{backgroundColor: colors.background}}>
      <Header title="Player Settings" />
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        <div
          className="p-4 rounded-2xl border space-y-4"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <div className="flex items-center justify-between">
            <span
              className="text-sm font-semibold"
              style={{color: colors.onSurface}}>
              Seek Step Interval
            </span>
            <select
              value={seekInterval}
              onChange={e => {
                const v = Number(e.target.value);
                setSeekInterval(v);
                settingsStorage.setSeekInterval(v);
              }}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
              style={{
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
                color: colors.onSurface,
              }}>
              {SEEK_INTERVAL_OPTIONS.map(s => (
                <option key={s} value={s}>
                  {s} seconds
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span
              className="text-sm font-semibold"
              style={{color: colors.onSurface}}>
              Default Playback Speed
            </span>
            <select
              value={defaultSpeed}
              onChange={e => {
                const v = Number(e.target.value);
                setDefaultSpeed(v);
                settingsStorage.setPlaybackSpeed(v);
              }}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
              style={{
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
                color: colors.onSurface,
              }}>
              {PLAYBACK_SPEEDS.map(s => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span
              className="text-sm font-semibold"
              style={{color: colors.onSurface}}>
              Default Aspect Ratio / Fit
            </span>
            <select
              value={resizeMode}
              onChange={e => {
                const v = e.target.value as any;
                setResizeMode(v);
                settingsStorage.setDefaultResizeMode(v);
              }}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
              style={{
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
                color: colors.onSurface,
              }}>
              {PLAYER_RESIZE_MODES.map(m => (
                <option key={m.mode} value={m.mode}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <span
              className="text-sm font-semibold"
              style={{color: colors.onSurface}}>
              Auto-play Next Episode
            </span>
            <input
              type="checkbox"
              checked={autoPlayNext}
              onChange={e => {
                setAutoPlayNext(e.target.checked);
                settingsStorage.setAutoPlayNextEpisode(e.target.checked);
              }}
              className="w-4 h-4 accent-white"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span
              className="text-sm font-semibold"
              style={{color: colors.onSurface}}>
              Hide On-Screen Rewind / Fast-Forward Buttons
            </span>
            <input
              type="checkbox"
              checked={hideSeekBtns}
              onChange={e => {
                setHideSeekBtns(e.target.checked);
                settingsStorage.setHideSeekButtons(e.target.checked);
              }}
              className="w-4 h-4 accent-white"
            />
          </label>
        </div>

        {/* Excluded Qualities */}
        <div
          className="p-4 rounded-2xl border"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <p
            className="text-sm font-semibold mb-1"
            style={{color: colors.onSurface}}>
            Excluded Stream Qualities
          </p>
          <p
            className="text-xs mb-3"
            style={{color: colors.onSurfaceVariant}}>
            Streams matching excluded resolutions will be filtered out when
            other qualities exist
          </p>
          <div className="flex flex-wrap gap-2">
            {['360p', '480p', '720p', '1080p', '2160p'].map(q => {
              const excluded = excludedQualities.includes(q);
              return (
                <button
                  key={q}
                  onClick={() => toggleExcludedQuality(q)}
                  className="px-3.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: excluded
                      ? colors.errorContainer
                      : colors.surfaceContainerHigh,
                    borderColor: colors.outlineVariant,
                    color: excluded
                      ? colors.onErrorContainer
                      : colors.onSurface,
                  }}>
                  {q} {excluded ? '(Excluded)' : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SubtitleSettingsScreen: React.FC = () => {
  const colors = useM3Colors();
  const [fontSize, setFontSize] = useState(() =>
    settingsStorage.getSubtitleFontSize(),
  );
  const [opacity, setOpacity] = useState(() =>
    settingsStorage.getSubtitleOpacity(),
  );

  return (
    <div
      className="flex-1 min-h-screen pb-24 sm:pb-12 overflow-y-auto select-none"
      style={{backgroundColor: colors.background}}>
      <Header title="Subtitles" />
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        <div
          className="p-4 rounded-2xl border space-y-4"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span style={{color: colors.onSurface}}>Subtitle Font Size</span>
              <span style={{color: colors.primary}}>{fontSize}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={36}
              value={fontSize}
              onChange={e => {
                const v = Number(e.target.value);
                setFontSize(v);
                settingsStorage.setSubtitleFontSize(v);
              }}
              className="w-full accent-white"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span style={{color: colors.onSurface}}>Background Opacity</span>
              <span style={{color: colors.primary}}>
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={opacity}
              onChange={e => {
                const v = Number(e.target.value);
                setOpacity(v);
                settingsStorage.setSubtitleOpacity(v);
              }}
              className="w-full accent-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const PreferencesScreen: React.FC = () => {
  const colors = useM3Colors();
  const {
    hideDownloadsTab,
    setHideDownloadsTab,
    showContinueWatching,
    setShowContinueWatching,
  } = useNavigationPreferencesStore();
  const [autoUpdateProviders, setAutoUpdateProviders] = useState(() =>
    settingsStorage.isProviderAutoUpdateEnabled(),
  );

  return (
    <div
      className="flex-1 min-h-screen pb-24 sm:pb-12 overflow-y-auto select-none"
      style={{backgroundColor: colors.background}}>
      <Header title="Preferences" />
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        <div
          className="p-4 rounded-2xl border space-y-4"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p
                className="text-sm font-semibold"
                style={{color: colors.onSurface}}>
                Show Continue Watching on Home
              </p>
              <p
                className="text-xs"
                style={{color: colors.onSurfaceVariant}}>
                Display in-progress movies and episodes on the Home screen
              </p>
            </div>
            <input
              type="checkbox"
              checked={showContinueWatching}
              onChange={e => setShowContinueWatching(e.target.checked)}
              className="w-4 h-4 accent-white"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p
                className="text-sm font-semibold"
                style={{color: colors.onSurface}}>
                Hide Downloads Tab
              </p>
              <p
                className="text-xs"
                style={{color: colors.onSurfaceVariant}}>
                Hide the Downloads tab from the main navigation bar
              </p>
            </div>
            <input
              type="checkbox"
              checked={hideDownloadsTab}
              onChange={e => setHideDownloadsTab(e.target.checked)}
              className="w-4 h-4 accent-white"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p
                className="text-sm font-semibold"
                style={{color: colors.onSurface}}>
                Auto-Update Installed Providers
              </p>
              <p
                className="text-xs"
                style={{color: colors.onSurfaceVariant}}>
                Check for provider updates automatically on startup
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoUpdateProviders}
              onChange={e => {
                setAutoUpdateProviders(e.target.checked);
                settingsStorage.setProviderAutoUpdateEnabled(e.target.checked);
              }}
              className="w-4 h-4 accent-white"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export const AboutScreen: React.FC = () => {
  const colors = useM3Colors();
  return (
    <div
      className="flex-1 min-h-screen pb-24 sm:pb-12 overflow-y-auto select-none"
      style={{backgroundColor: colors.background}}>
      <Header title="About Vega" />
      <div className="max-w-xl mx-auto px-4 pt-8 text-center">
        <div
          className="p-8 rounded-3xl border"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <h2
            className="text-2xl font-extrabold mb-1"
            style={{color: colors.onSurface}}>
            Vega Web
          </h2>
          <p
            className="text-xs font-semibold mb-4"
            style={{color: colors.primary}}>
            v3.4.2 • Web Browser Edition
          </p>
          <p
            className="text-xs leading-relaxed mb-6"
            style={{color: colors.onSurfaceVariant}}>
            Vega is a modular, extension-driven media discovery and streaming
            application. Providers are loaded and executed dynamically using the
            Vega provider runtime specification.
          </p>
          <a
            href="https://vega.8man.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-full inline-flex items-center gap-2 text-xs font-bold"
            style={{
              backgroundColor: colors.primary,
              color: colors.onPrimary,
            }}>
            <span>Official Documentation (vega.8man.in)</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};
