import React, {useRef, useState} from 'react';
import {
  Layers,
  Palette,
  Sliders,
  PlayCircle,
  Subtitles,
  Info,
  Trash2,
  Download,
  Upload,
  ChevronRight,
  Film,
  RotateCcw,
  GitBranch,
  ExternalLink,
  Loader2,
  Check,
} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation} from '../NavigationContext';
import useContentStore from '../lib/zustand/contentStore';
import useWatchListStore from '../lib/zustand/watchListStore';
import useContinueWatchingStore from '../lib/zustand/continueWatchingStore';
import {
  cacheStorageService,
  clearAllMMKVStorage,
  mainStorage,
  extensionStorage,
} from '../lib/storage';
import {showAppDialog} from '../lib/zustand/appDialogStore';

export const Settings: React.FC = () => {
  const colors = useM3Colors();
  const {navigate} = useVegaNavigation();
  const {provider, setProvider, installedProviders} = useContentStore();
  const {watchList} = useWatchListStore();
  const {items: continueWatchingItems} = useContinueWatchingStore();
  const backupInputRef = useRef<HTMLInputElement>(null);

  const [githubOwner, setGithubOwner] = useState('rahul882213');
  const [githubRepo, setGithubRepo] = useState('Vega-Web');
  const [githubToken, setGithubToken] = useState('');
  const [githubPushing, setGithubPushing] = useState(false);
  const [pushedRepoUrl, setPushedRepoUrl] = useState<string | null>(null);

  const handlePushToGithub = async () => {
    if (!githubToken.trim()) {
      showAppDialog({
        title: 'GitHub Token Required',
        message:
          'Please paste a GitHub Personal Access Token (with "repo" scope) to create and push to https://github.com/rahul882213/Vega-Web.',
        variant: 'warning',
      });
      return;
    }

    setGithubPushing(true);
    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          token: githubToken.trim(),
          owner: githubOwner.trim() || 'rahul882213',
          repoName: githubRepo.trim() || 'Vega-Web',
          description:
            'Vega Web — Exact web browser version of the Vega streaming application',
          isPrivate: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to push repository to GitHub');
      }
      setPushedRepoUrl(data.repoUrl);
      showAppDialog({
        title: 'Pushed to GitHub!',
        message: `Successfully created and pushed Vega Web to ${data.repoUrl}`,
        variant: 'success',
      });
    } catch (err) {
      showAppDialog({
        title: 'GitHub Push Failed',
        message:
          err instanceof Error
            ? err.message
            : 'Could not push to GitHub repository.',
        variant: 'error',
      });
    } finally {
      setGithubPushing(false);
    }
  };

  const handleClearCache = () => {
    cacheStorageService.clearAll();
    showAppDialog({
      title: 'Cache Cleared',
      message: 'Temporary cache has been cleared.',
      variant: 'success',
    });
  };

  const handleExportBackup = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      providerSources: extensionStorage.getProviderSources(),
      installedProviders: extensionStorage.getInstalledProviders(),
      watchList,
      continueWatching: continueWatchingItems,
      collections: mainStorage.getArray('library-collections') || [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vega-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.providerSources)) {
        extensionStorage.setProviderSources(parsed.providerSources);
      }
      if (Array.isArray(parsed.WatchList || parsed.watchList)) {
        mainStorage.setArray(
          'watchlist',
          parsed.WatchList || parsed.watchList,
        );
      }
      showAppDialog({
        title: 'Backup Imported',
        message: 'Backup restored. Reloading Vega state...',
        variant: 'success',
        actions: [
          {
            label: 'Reload',
            variant: 'primary',
            onPress: () => window.location.reload(),
          },
        ],
      });
    } catch (err) {
      showAppDialog({
        title: 'Import Failed',
        message:
          err instanceof Error ? err.message : 'Invalid backup JSON file.',
        variant: 'error',
      });
    }
  };

  const handleEraseAllData = () => {
    showAppDialog({
      title: 'Erase All Data',
      message:
        'This will clear all installed providers, library items, playback history, and settings. Continue?',
      variant: 'warning',
      actions: [
        {label: 'Cancel', variant: 'secondary'},
        {
          label: 'Erase All',
          variant: 'destructive',
          onPress: () => {
            clearAllMMKVStorage();
            window.location.reload();
          },
        },
      ],
    });
  };

  return (
    <div
      className="flex-1 min-h-screen px-4 pt-6 pb-24 sm:pb-12 overflow-y-auto select-none"
      style={{backgroundColor: colors.background}}>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{color: colors.onSurface}}>
          Settings
        </h1>

        {/* Active Content Provider Strip + Provider Manager */}
        <section>
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2.5 px-1"
            style={{color: colors.primary}}>
            Content Provider
          </p>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            }}>
            <div className="p-3.5 border-b" style={{borderColor: colors.outlineVariant}}>
              {installedProviders.length === 0 ? (
                <p
                  className="text-xs py-2"
                  style={{color: colors.onSurfaceVariant}}>
                  No providers installed. Open Provider Manager below to install
                  providers.
                </p>
              ) : (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                  {installedProviders.map(item => {
                    const isSelected = provider.value === item.value;
                    return (
                      <button
                        key={`${item.source?.author}:${item.value}`}
                        onClick={() => setProvider(item)}
                        className="px-3.5 py-2 rounded-xl border flex items-center gap-2.5 shrink-0 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isSelected
                            ? colors.secondaryContainer
                            : colors.surfaceContainerHigh,
                          borderColor: isSelected
                            ? colors.primary
                            : colors.outlineVariant,
                          color: isSelected
                            ? colors.onSecondaryContainer
                            : colors.onSurface,
                        }}>
                        {item.icon ? (
                          <img
                            src={item.icon}
                            alt={item.display_name}
                            className="w-6 h-6 rounded-md object-cover bg-black/30"
                          />
                        ) : (
                          <Film size={15} />
                        )}
                        <span className="text-xs font-semibold">
                          {item.display_name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => navigate({name: 'Extensions'})}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Layers size={19} style={{color: colors.primary}} />
                <div className="text-left">
                  <p
                    className="text-sm font-semibold"
                    style={{color: colors.onSurface}}>
                    Provider Manager
                  </p>
                  <p
                    className="text-xs"
                    style={{color: colors.onSurfaceVariant}}>
                    Add sources, install, update, and test providers
                  </p>
                </div>
              </div>
              <ChevronRight size={18} style={{color: colors.onSurfaceVariant}} />
            </button>
          </div>
        </section>

        {/* GitHub Repository Push Section (rahul882213 / Vega-Web) */}
        <section>
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2.5 px-1"
            style={{color: colors.primary}}>
            GitHub Repository Sync
          </p>
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <GitBranch size={19} style={{color: colors.primary}} />
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{color: colors.onSurface}}>
                    Create & Push to GitHub ({githubOwner}/{githubRepo})
                  </p>
                  <p
                    className="text-xs"
                    style={{color: colors.onSurfaceVariant}}>
                    Creates a new repository on github.com/{githubOwner} and pushes the complete Vega Web source code
                  </p>
                </div>
              </div>
              <a
                href="https://github.com/settings/tokens/new?description=Vega-Web&scopes=repo"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 shrink-0"
                style={{
                  backgroundColor: colors.surfaceContainerHigh,
                  color: colors.primary,
                }}>
                <span>Get Token</span>
                <ExternalLink size={12} />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={githubOwner}
                onChange={e => setGithubOwner(e.target.value)}
                placeholder="GitHub Username (rahul882213)"
                className="h-9 px-3 rounded-xl border text-xs outline-none"
                style={{
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                }}
              />
              <input
                type="text"
                value={githubRepo}
                onChange={e => setGithubRepo(e.target.value)}
                placeholder="Repository Name (Vega-Web)"
                className="h-9 px-3 rounded-xl border text-xs outline-none"
                style={{
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                }}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="password"
                value={githubToken}
                onChange={e => setGithubToken(e.target.value)}
                placeholder="Paste GitHub Personal Access Token (ghp_...)"
                className="flex-1 h-9 px-3 rounded-xl border text-xs outline-none"
                style={{
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                }}
              />
              <button
                onClick={handlePushToGithub}
                disabled={githubPushing}
                className="h-9 px-5 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                }}>
                {githubPushing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Pushing...</span>
                  </>
                ) : (
                  <>
                    <GitBranch size={14} />
                    <span>Create & Push Repo</span>
                  </>
                )}
              </button>
            </div>

            {pushedRepoUrl && (
              <div
                className="p-3 rounded-xl border flex items-center justify-between gap-2"
                style={{
                  backgroundColor: colors.secondaryContainer,
                  borderColor: colors.primary,
                }}>
                <div className="flex items-center gap-2 min-w-0">
                  <Check
                    size={16}
                    style={{color: colors.onSecondaryContainer}}
                  />
                  <span
                    className="text-xs font-semibold truncate"
                    style={{color: colors.onSecondaryContainer}}>
                    Repository pushed: {pushedRepoUrl}
                  </span>
                </div>
                <a
                  href={pushedRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shrink-0"
                  style={{
                    backgroundColor: colors.primary,
                    color: colors.onPrimary,
                  }}>
                  <span>Open Repo</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Options Section */}
        <section>
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2.5 px-1"
            style={{color: colors.primary}}>
            Options
          </p>
          <div
            className="rounded-2xl border divide-y overflow-hidden"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            }}>
            {[
              {
                name: 'Appearance' as const,
                title: 'Appearance',
                subtitle: 'Material 3 seed colors, dynamic accent, tab labels',
                icon: Palette,
              },
              {
                name: 'PlayerSettings' as const,
                title: 'Player',
                subtitle: 'Seek interval, default speed, auto-play next episode',
                icon: PlayCircle,
              },
              {
                name: 'SubtitleSettings' as const,
                title: 'Subtitles',
                subtitle: 'Font size, background opacity, edge style',
                icon: Subtitles,
              },
              {
                name: 'Preferences' as const,
                title: 'Preferences',
                subtitle: 'Continue watching row, navigation tabs, provider auto-update',
                icon: Sliders,
              },
            ].map(row => {
              const Icon = row.icon;
              return (
                <button
                  key={row.name}
                  onClick={() => navigate({name: row.name})}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer"
                  style={{borderColor: colors.outlineVariant}}>
                  <div className="flex items-center gap-3">
                    <Icon size={19} style={{color: colors.primary}} />
                    <div className="text-left">
                      <p
                        className="text-sm font-semibold"
                        style={{color: colors.onSurface}}>
                        {row.title}
                      </p>
                      <p
                        className="text-xs"
                        style={{color: colors.onSurfaceVariant}}>
                        {row.subtitle}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    style={{color: colors.onSurfaceVariant}}
                  />
                </button>
              );
            })}
          </div>
        </section>

        {/* Data Management */}
        <section>
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2.5 px-1"
            style={{color: colors.primary}}>
            Data Management
          </p>
          <div
            className="rounded-2xl border divide-y overflow-hidden"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            }}>
            <div
              className="px-4 py-3.5 flex items-center justify-between"
              style={{borderColor: colors.outlineVariant}}>
              <div className="flex items-center gap-3">
                <RotateCcw size={18} style={{color: colors.primary}} />
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{color: colors.onSurface}}>
                    Clear Cache
                  </p>
                  <p
                    className="text-xs"
                    style={{color: colors.onSurfaceVariant}}>
                    Clears temporary cached responses and base URLs
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearCache}
                className="px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: colors.secondaryContainer,
                  color: colors.onSecondaryContainer,
                }}>
                Clear
              </button>
            </div>

            <div
              className="px-4 py-3.5 flex items-center justify-between"
              style={{borderColor: colors.outlineVariant}}>
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{color: colors.onSurface}}>
                  Backup & Restore
                </p>
                <p
                  className="text-xs"
                  style={{color: colors.onSurfaceVariant}}>
                  Export or import your providers, library, and watch history
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportBackup}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer"
                  style={{
                    backgroundColor: colors.secondaryContainer,
                    color: colors.onSecondaryContainer,
                  }}>
                  <Download size={13} />
                  <span>Export</span>
                </button>
                <button
                  onClick={() => backupInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer"
                  style={{
                    backgroundColor: colors.secondaryContainer,
                    color: colors.onSecondaryContainer,
                  }}>
                  <Upload size={13} />
                  <span>Import</span>
                </button>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportBackup}
                />
              </div>
            </div>

            <div
              className="px-4 py-3.5 flex items-center justify-between"
              style={{borderColor: colors.outlineVariant}}>
              <div className="flex items-center gap-3">
                <Trash2 size={18} style={{color: colors.error}} />
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{color: colors.onSurface}}>
                    Erase All Data
                  </p>
                  <p
                    className="text-xs"
                    style={{color: colors.onSurfaceVariant}}>
                    Resets Vega Web to a clean state
                  </p>
                </div>
              </div>
              <button
                onClick={handleEraseAllData}
                className="px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: colors.errorContainer,
                  color: colors.onErrorContainer,
                }}>
                Erase
              </button>
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2.5 px-1"
            style={{color: colors.primary}}>
            Support & Info
          </p>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            }}>
            <button
              onClick={() => navigate({name: 'About'})}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Info size={19} style={{color: colors.primary}} />
                <span
                  className="text-sm font-semibold"
                  style={{color: colors.onSurface}}>
                  About Vega
                </span>
              </div>
              <ChevronRight size={18} style={{color: colors.onSurfaceVariant}} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

