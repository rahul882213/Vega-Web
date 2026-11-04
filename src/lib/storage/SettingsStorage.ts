import {mainStorage} from './StorageService';

export type VerificationWindowPolicy = 'ask' | 'allow' | 'block';

export enum SettingsKeys {
  PRIMARY_COLOR = 'primaryColor',
  IS_CUSTOM_THEME = 'isCustomTheme',
  SHOW_TAB_BAR_LABELS = 'showTabBarLabels',
  HIDE_DOWNLOADS_TAB = 'hideDownloadsTab',
  SHOW_CONTINUE_WATCHING = 'showContinueWatching',
  CUSTOM_COLOR = 'customColor',
  ACCENT_SOURCE = 'accentSource',
  LAUNCHER_ICON = 'launcherIcon',
  DYNAMIC_INFO_ACCENT = 'dynamicInfoAccent',
  HAPTIC_FEEDBACK = 'hapticFeedback',
  NOTIFICATIONS_ENABLED = 'notificationsEnabled',
  AUTO_CHECK_UPDATE = 'autoCheckUpdate',
  AUTO_DOWNLOAD = 'autoDownload',
  AUTO_UPDATE_PROVIDERS = 'autoUpdateProviders',
  VERIFICATION_WINDOWS = 'verificationWindows',
  OPEN_VIDEOS_FROM_OTHER_APPS = 'openVideosFromOtherApps',
  SHOW_MEDIA_CONTROLS = 'showMediaControls',
  SHOW_HAMBURGER_MENU = 'showHamburgerMenu',
  HIDE_SEEK_BUTTONS = 'hideSeekButtons',
  SHOW_PLAYER_EPISODE_SIDEBAR = 'showPlayerEpisodeSidebar',
  AUTO_PLAY_NEXT_EPISODE = 'autoPlayNextEpisode',
  SHOW_SLEEP_TIMER = 'showSleepTimer',
  SHOW_TIME_REMAINING = 'showTimeRemaining',
  AMBIENT_VIDEO = 'ambientVideo',
  ENABLE_2X_GESTURE = 'enable2xGesture',
  SEEK_INTERVAL = 'seekInterval',
  PLAYBACK_SPEED = 'playbackSpeed',
  DEFAULT_RESIZE_MODE = 'defaultResizeMode',
  EXCLUDED_QUALITIES = 'excludedQualities',
  PROVIDER_ORDER = 'providerOrder',
  SUBTITLE_FONT_SIZE = 'subtitleFontSize',
  SUBTITLE_OPACITY = 'subtitleOpacity',
  SUBTITLE_TEXT_OPACITY = 'subtitleTextOpacity',
  SUBTITLE_BOTTOM_PADDING = 'subtitleBottomPadding',
  SUBTITLE_TEXT_COLOR = 'subtitleTextColor',
  SUBTITLE_FONT_FAMILY = 'subtitleFontFamily',
  SUBTITLE_EDGE_TYPE = 'subtitleEdgeType',
  SUBTITLE_EDGE_COLOR = 'subtitleEdgeColor',
  SUBTITLE_OUTLINE_WIDTH = 'subtitleOutlineWidth',
  LIST_VIEW_TYPE = 'viewType',
  TMDB_API_KEY = 'tmdbApiKey',
  TMDB_API_KEY_REVISION = 'tmdbApiKeyRevision',
  SKIP_IN_APP_WEBVIEW = 'skipInAppWebview',
  ASK_LOCAL_FILE_FIRST = 'askLocalFileFirst',
  CUSTOM_REMOTE_BACKEND = 'customRemoteBackend',
}

export const BUFFER_LIMITS = {
  forwardMin: 16,
  forwardMax: 256,
  backMax: 128,
  step: 16,
} as const;

export const MIN_DOWNLOAD_CONNECTIONS = 1;
export const MAX_DOWNLOAD_CONNECTIONS = 16;

export const SEEK_INTERVAL_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
] as const;
const DEFAULT_SEEK_INTERVAL = 10;

export const PLAYBACK_SPEEDS = [
  0.25, 0.5, 0.75, 1.0, 1.25, 1.35, 1.5, 1.75, 2,
] as const;
export const PLAYBACK_SPEED_MIN = 0.25;
export const PLAYBACK_SPEED_MAX = 2;
export const PLAYBACK_SPEED_STEP = 0.05;
const DEFAULT_PLAYBACK_SPEED = 1.0;

export const PLAYER_RESIZE_MODES = [
  {mode: 'none', label: 'Fit'},
  {mode: 'cover', label: 'Cover'},
  {mode: 'stretch', label: 'Stretch'},
  {mode: 'contain', label: 'Contain'},
] as const;
export type PlayerResizeMode = (typeof PLAYER_RESIZE_MODES)[number]['mode'];
const DEFAULT_RESIZE_MODE: PlayerResizeMode = 'none';

const isPlayerResizeMode = (value: unknown): value is PlayerResizeMode =>
  PLAYER_RESIZE_MODES.some(option => option.mode === value);

const isAllowedPlaybackSpeed = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= PLAYBACK_SPEED_MIN &&
  value <= PLAYBACK_SPEED_MAX;

export class SettingsStorage {
  getVerificationWindowPolicy(): VerificationWindowPolicy {
    const value = mainStorage.getString(SettingsKeys.VERIFICATION_WINDOWS);
    return value === 'allow' || value === 'block' ? value : 'ask';
  }

  setVerificationWindowPolicy(value: VerificationWindowPolicy): void {
    mainStorage.setString(SettingsKeys.VERIFICATION_WINDOWS, value);
  }

  isAskLocalFileFirst(): boolean {
    return mainStorage.getBool(SettingsKeys.ASK_LOCAL_FILE_FIRST, false);
  }

  setAskLocalFileFirst(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.ASK_LOCAL_FILE_FIRST, enabled);
  }

  getPrimaryColor(): string {
    return mainStorage.getString(SettingsKeys.PRIMARY_COLOR) || '#FFFFFF';
  }

  setPrimaryColor(color: string): void {
    mainStorage.setString(SettingsKeys.PRIMARY_COLOR, color);
  }

  isCustomTheme(): boolean {
    return mainStorage.getBool(SettingsKeys.IS_CUSTOM_THEME);
  }

  setCustomTheme(isCustom: boolean): void {
    mainStorage.setBool(SettingsKeys.IS_CUSTOM_THEME, isCustom);
  }

  getCustomColor(): string {
    return mainStorage.getString(SettingsKeys.CUSTOM_COLOR) || '#FFFFFF';
  }

  setCustomColor(color: string): void {
    mainStorage.setString(SettingsKeys.CUSTOM_COLOR, color);
  }

  getAccentSource(): 'wallpaper' | 'custom' {
    return mainStorage.getString(SettingsKeys.ACCENT_SOURCE) === 'wallpaper'
      ? 'wallpaper'
      : 'custom';
  }

  setAccentSource(source: 'wallpaper' | 'custom'): void {
    mainStorage.setString(SettingsKeys.ACCENT_SOURCE, source);
  }

  isDynamicInfoAccentEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.DYNAMIC_INFO_ACCENT, true);
  }

  setDynamicInfoAccentEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.DYNAMIC_INFO_ACCENT, enabled);
  }

  showTabBarLabels(): boolean {
    return mainStorage.getBool(SettingsKeys.SHOW_TAB_BAR_LABELS, true);
  }

  setShowTabBarLabels(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_TAB_BAR_LABELS, show);
  }

  hideDownloadsTab(): boolean {
    return mainStorage.getBool(SettingsKeys.HIDE_DOWNLOADS_TAB, false);
  }

  setHideDownloadsTab(hide: boolean): void {
    mainStorage.setBool(SettingsKeys.HIDE_DOWNLOADS_TAB, hide);
  }

  showContinueWatching(): boolean {
    return mainStorage.getBool(SettingsKeys.SHOW_CONTINUE_WATCHING, true);
  }

  setShowContinueWatching(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_CONTINUE_WATCHING, show);
  }

  isHapticFeedbackEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.HAPTIC_FEEDBACK, true);
  }

  setHapticFeedbackEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.HAPTIC_FEEDBACK, enabled);
  }

  isProviderAutoUpdateEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.AUTO_UPDATE_PROVIDERS, true);
  }

  setProviderAutoUpdateEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.AUTO_UPDATE_PROVIDERS, enabled);
  }

  showMediaControls(): boolean {
    return mainStorage.getBool(SettingsKeys.SHOW_MEDIA_CONTROLS, true);
  }

  setShowMediaControls(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_MEDIA_CONTROLS, show);
  }

  showHamburgerMenu(): boolean {
    return mainStorage.getBool(SettingsKeys.SHOW_HAMBURGER_MENU, true);
  }

  setShowHamburgerMenu(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_HAMBURGER_MENU, show);
  }

  hideSeekButtons(): boolean {
    return mainStorage.getBool(SettingsKeys.HIDE_SEEK_BUTTONS, false);
  }

  setHideSeekButtons(hide: boolean): void {
    mainStorage.setBool(SettingsKeys.HIDE_SEEK_BUTTONS, hide);
  }

  showPlayerEpisodeSidebar(): boolean {
    return mainStorage.getBool(SettingsKeys.SHOW_PLAYER_EPISODE_SIDEBAR, true);
  }

  setShowPlayerEpisodeSidebar(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_PLAYER_EPISODE_SIDEBAR, show);
  }

  isAutoPlayNextEpisodeEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.AUTO_PLAY_NEXT_EPISODE, true);
  }

  setAutoPlayNextEpisode(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.AUTO_PLAY_NEXT_EPISODE, enabled);
  }

  isAmbientVideoEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.AMBIENT_VIDEO, false);
  }

  setAmbientVideoEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.AMBIENT_VIDEO, enabled);
  }

  showSleepTimer(): boolean {
    return mainStorage.getBool(SettingsKeys.SHOW_SLEEP_TIMER, true);
  }

  setShowSleepTimer(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_SLEEP_TIMER, show);
  }

  isShowTimeRemaining(): boolean {
    return mainStorage.getBool(SettingsKeys.SHOW_TIME_REMAINING, false);
  }

  setShowTimeRemaining(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_TIME_REMAINING, show);
  }

  isEnable2xGestureEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.ENABLE_2X_GESTURE, true);
  }

  setEnable2xGesture(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.ENABLE_2X_GESTURE, enabled);
  }

  getSeekInterval(): number {
    const value = mainStorage.getNumber(SettingsKeys.SEEK_INTERVAL);
    return (SEEK_INTERVAL_OPTIONS as readonly number[]).includes(
      value as number,
    )
      ? (value as number)
      : DEFAULT_SEEK_INTERVAL;
  }

  setSeekInterval(seconds: number): void {
    if ((SEEK_INTERVAL_OPTIONS as readonly number[]).includes(seconds)) {
      mainStorage.setNumber(SettingsKeys.SEEK_INTERVAL, seconds);
    }
  }

  getExcludedQualities(): string[] {
    return mainStorage.getArray<string>(SettingsKeys.EXCLUDED_QUALITIES) || [];
  }

  setExcludedQualities(qualities: string[]): void {
    mainStorage.setArray(SettingsKeys.EXCLUDED_QUALITIES, qualities);
  }

  getProviderOrder(): string[] {
    return mainStorage.getArray<string>(SettingsKeys.PROVIDER_ORDER) || [];
  }

  setProviderOrder(keys: string[]): void {
    mainStorage.setArray(SettingsKeys.PROVIDER_ORDER, keys);
  }

  getPlaybackSpeed(): number {
    const value = mainStorage.getNumber(SettingsKeys.PLAYBACK_SPEED);
    return isAllowedPlaybackSpeed(value) ? value : DEFAULT_PLAYBACK_SPEED;
  }

  setPlaybackSpeed(speed: number): void {
    if (isAllowedPlaybackSpeed(speed)) {
      mainStorage.setNumber(SettingsKeys.PLAYBACK_SPEED, speed);
    }
  }

  getDefaultResizeMode(): PlayerResizeMode {
    const value = mainStorage.getString(SettingsKeys.DEFAULT_RESIZE_MODE);
    return isPlayerResizeMode(value) ? value : DEFAULT_RESIZE_MODE;
  }

  setDefaultResizeMode(mode: PlayerResizeMode): void {
    if (isPlayerResizeMode(mode)) {
      mainStorage.setString(SettingsKeys.DEFAULT_RESIZE_MODE, mode);
    }
  }

  getSubtitleFontSize(): number {
    return mainStorage.getNumber(SettingsKeys.SUBTITLE_FONT_SIZE) ?? 20;
  }

  setSubtitleFontSize(size: number): void {
    mainStorage.setNumber(SettingsKeys.SUBTITLE_FONT_SIZE, size);
  }

  getSubtitleOpacity(): number {
    const opacityStr = mainStorage.getString(SettingsKeys.SUBTITLE_OPACITY);
    return opacityStr !== undefined && opacityStr !== ''
      ? parseFloat(opacityStr)
      : 0.7;
  }

  setSubtitleOpacity(opacity: number): void {
    mainStorage.setString(SettingsKeys.SUBTITLE_OPACITY, opacity.toString());
  }

  getSubtitleTextOpacity(): number {
    const value = mainStorage.getNumber(SettingsKeys.SUBTITLE_TEXT_OPACITY);
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.min(Math.max(value, 0.2), 1)
      : 1;
  }

  setSubtitleTextOpacity(opacity: number): void {
    mainStorage.setNumber(
      SettingsKeys.SUBTITLE_TEXT_OPACITY,
      Math.min(Math.max(opacity, 0.2), 1),
    );
  }

  getSubtitleBottomPadding(): number {
    return mainStorage.getNumber(SettingsKeys.SUBTITLE_BOTTOM_PADDING) ?? 24;
  }

  setSubtitleBottomPadding(padding: number): void {
    mainStorage.setNumber(SettingsKeys.SUBTITLE_BOTTOM_PADDING, padding);
  }

  getSubtitleTextColor(): string {
    return mainStorage.getString(SettingsKeys.SUBTITLE_TEXT_COLOR) || '#FFFFFF';
  }

  setSubtitleTextColor(color: string): void {
    mainStorage.setString(SettingsKeys.SUBTITLE_TEXT_COLOR, color);
  }

  getSubtitleFontFamily(): string {
    return (
      mainStorage.getString(SettingsKeys.SUBTITLE_FONT_FAMILY) || 'default'
    );
  }

  setSubtitleFontFamily(font: string): void {
    mainStorage.setString(SettingsKeys.SUBTITLE_FONT_FAMILY, font);
  }

  getSubtitleEdgeType():
    | 'outline'
    | 'dropShadow'
    | 'raised'
    | 'depressed'
    | 'none' {
    const val = mainStorage.getString(SettingsKeys.SUBTITLE_EDGE_TYPE);
    if (
      val === 'dropShadow' ||
      val === 'raised' ||
      val === 'depressed' ||
      val === 'none'
    ) {
      return val;
    }
    return 'outline';
  }

  setSubtitleEdgeType(
    edgeType: 'outline' | 'dropShadow' | 'raised' | 'depressed' | 'none',
  ): void {
    mainStorage.setString(SettingsKeys.SUBTITLE_EDGE_TYPE, edgeType);
  }

  getSubtitleEdgeColor(): string {
    return mainStorage.getString(SettingsKeys.SUBTITLE_EDGE_COLOR) || '#000000';
  }

  setSubtitleEdgeColor(color: string): void {
    mainStorage.setString(SettingsKeys.SUBTITLE_EDGE_COLOR, color);
  }

  getSubtitleOutlineWidth(): number {
    return mainStorage.getNumber(SettingsKeys.SUBTITLE_OUTLINE_WIDTH) ?? 2;
  }

  setSubtitleOutlineWidth(width: number): void {
    mainStorage.setNumber(SettingsKeys.SUBTITLE_OUTLINE_WIDTH, width);
  }

  getListViewType(): number {
    return parseInt(
      mainStorage.getString(SettingsKeys.LIST_VIEW_TYPE) || '1',
      10,
    );
  }

  setListViewType(type: number): void {
    mainStorage.setString(SettingsKeys.LIST_VIEW_TYPE, type.toString());
  }

  getTmdbApiKey(): string {
    return mainStorage.getString(SettingsKeys.TMDB_API_KEY)?.trim() || '';
  }

  setTmdbApiKey(apiKey: string): void {
    const normalizedKey = apiKey.trim();
    if (normalizedKey) {
      mainStorage.setString(SettingsKeys.TMDB_API_KEY, normalizedKey);
    } else {
      mainStorage.delete(SettingsKeys.TMDB_API_KEY);
    }
    mainStorage.setNumber(
      SettingsKeys.TMDB_API_KEY_REVISION,
      this.getTmdbApiKeyRevision() + 1,
    );
  }

  getTmdbApiKeyRevision(): number {
    return mainStorage.getNumber(SettingsKeys.TMDB_API_KEY_REVISION) || 0;
  }

  getBool(key: string, defaultValue = false): boolean {
    return mainStorage.getBool(key, defaultValue);
  }

  setBool(key: string, value: boolean): void {
    mainStorage.setBool(key, value);
  }

  isSkipInAppWebview(): boolean {
    return mainStorage.getBool(SettingsKeys.SKIP_IN_APP_WEBVIEW, false);
  }

  setSkipInAppWebview(skip: boolean): void {
    mainStorage.setBool(SettingsKeys.SKIP_IN_APP_WEBVIEW, skip);
  }

  getRemoteBackendUrl(): string {
    const custom = mainStorage.getString(SettingsKeys.CUSTOM_REMOTE_BACKEND);
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
    return 'https://vegawebs.netlify.app';
  }

  setRemoteBackendUrl(url: string): void {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (trimmed) {
      mainStorage.setString(SettingsKeys.CUSTOM_REMOTE_BACKEND, trimmed);
    } else {
      mainStorage.delete(SettingsKeys.CUSTOM_REMOTE_BACKEND);
    }
  }
}

export const settingsStorage = new SettingsStorage();

export function isStaticOrGitHubPagesHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.endsWith('github.io') ||
    (!host.includes('localhost') &&
      !host.includes('127.0.0.1') &&
      !host.includes('netlify.app') &&
      !host.endsWith('.run.app'))
  );
}

export function getEffectiveApiBaseUrl(): string {
  if (isStaticOrGitHubPagesHost()) {
    return settingsStorage.getRemoteBackendUrl();
  }
  return '';
}
