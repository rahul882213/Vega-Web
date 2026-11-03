import React, {useState, useEffect, useMemo} from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Download,
  Check,
  Activity,
  SlidersHorizontal,
  Film,
  Layers,
  Lock,
  Globe,
  X,
  Loader2,
  ArrowUpCircle,
} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation} from '../NavigationContext';
import useContentStore from '../lib/zustand/contentStore';
import {
  extensionStorage,
  ProviderExtension,
  ProviderSource,
  isSameSource,
} from '../lib/storage/extensionStorage';
import {sourceTokenStorage} from '../lib/storage/sourceTokenStorage';
import {extensionManager} from '../lib/services/ExtensionManager';
import {providerManager} from '../lib/services/ProviderManager';
import {
  testProvider,
  DiagnosticProgressEvent,
} from '../lib/services/providerDiagnostics';
import {showAppDialog} from '../lib/zustand/appDialogStore';
import {ProviderTestProgressDialog} from '../components/ProviderTestProgressDialog';
import {ProviderSettingsModal} from '../components/ProviderSettingsModal';
import {useQueryClient} from '@tanstack/react-query';

export const Extensions: React.FC = () => {
  const colors = useM3Colors();
  const {goBack} = useVegaNavigation();
  const queryClient = useQueryClient();

  const {
    provider: activeExtensionProvider,
    setProvider: setActiveExtensionProvider,
    installedProviders,
    availableProviders,
    setInstalledProviders,
    setAvailableProviders,
  } = useContentStore();

  const [activeTab, setActiveTab] = useState<'installed' | 'available'>(() =>
    (extensionStorage.getInstalledProviders() || []).length > 0
      ? 'installed'
      : 'available',
  );

  const [sources, setSources] = useState<ProviderSource[]>(() =>
    extensionStorage.getProviderSources(),
  );
  const [selectedSourceFilter, setSelectedSourceFilter] =
    useState<string>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [refreshing, setRefreshing] = useState(false);
  const [installingMap, setInstallingMap] = useState<Record<string, boolean>>(
    {},
  );
  const [updatingAll, setUpdatingAll] = useState(false);

  // Add Source Modal state
  const [addSourceModalOpen, setAddSourceModalOpen] = useState(false);
  const [newSourceInput, setNewSourceInput] = useState('');
  const [newSourcePrivate, setNewSourcePrivate] = useState(false);
  const [newSourceToken, setNewSourceToken] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  // Diagnostic test state
  const [testingProvider, setTestingProvider] =
    useState<ProviderExtension | null>(null);
  const [testEvents, setTestEvents] = useState<
    Record<string, DiagnosticProgressEvent>
  >({});

  // Provider settings modal state
  const [settingsProvider, setSettingsProvider] =
    useState<ProviderExtension | null>(null);

  const syncAvailableProvidersFromStorage = (sourceList: ProviderSource[]) => {
    const merged: ProviderExtension[] = [];
    sourceList.forEach(src => {
      const list = extensionStorage.getAvailableProviders(src.author);
      list.forEach(item => {
        if (
          !merged.some(
            m => m.value === item.value && isSameSource(m.source, item.source),
          )
        ) {
          merged.push(item);
        }
      });
    });
    setAvailableProviders(merged);
  };

  const handleRefreshManifests = async (force = true) => {
    const currentSources = extensionStorage.getProviderSources();
    setSources(currentSources);
    if (currentSources.length === 0) {
      setAvailableProviders([]);
      return;
    }

    setRefreshing(true);
    try {
      await Promise.allSettled(
        currentSources.map(src => extensionManager.fetchManifest(src, force)),
      );
      syncAvailableProvidersFromStorage(currentSources);
      setInstalledProviders(extensionStorage.getInstalledProviders());
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const currentSources = extensionStorage.getProviderSources();
    setSources(currentSources);
    syncAvailableProvidersFromStorage(currentSources);

    // Automatically fetch manifests on open if availableProviders is empty
    const hasCached = currentSources.some(
      s => extensionStorage.getAvailableProviders(s.author).length > 0,
    );
    if (!hasCached && currentSources.length > 0) {
      handleRefreshManifests(true);
    }
  }, []);

  const handleAddSource = async () => {
    const trimmed = newSourceInput.trim();
    if (!trimmed) return;

    const baseSource = extensionManager.createBaseSource(trimmed);
    if (!baseSource.author || !baseSource.url) {
      showAppDialog({
        title: 'Invalid Provider Source',
        message:
          'Enter a GitHub username (e.g. Zenda-Cross) or a full repository / manifest URL.',
        variant: 'error',
      });
      return;
    }

    setAddingSource(true);
    try {
      const candidate: ProviderSource = {
        ...baseSource,
        isPrivate: newSourcePrivate,
      };
      if (newSourcePrivate && newSourceToken.trim()) {
        await sourceTokenStorage.setToken(
          candidate.author,
          newSourceToken.trim(),
        );
      }

      const fetched = await extensionManager.fetchManifest(candidate, true);
      if (!fetched || fetched.length === 0) {
        throw new Error('Manifest returned no valid providers');
      }

      extensionStorage.addProviderSource(
        candidate.author,
        candidate.url,
        newSourcePrivate,
      );
      extensionStorage.setDefaultProviderSource(candidate.author);
      const updatedSources = extensionStorage.getProviderSources();
      setSources(updatedSources);
      syncAvailableProvidersFromStorage(updatedSources);
      setSelectedSourceFilter(candidate.author);
      setActiveTab('available');

      setAddSourceModalOpen(false);
      setNewSourceInput('');
      setNewSourceToken('');
      setNewSourcePrivate(false);

      showAppDialog({
        title: 'Provider Source Added',
        message: `Added ${candidate.author} with ${fetched.length} available providers. You can now install individual providers below.`,
        variant: 'success',
      });
    } catch (err) {
      showAppDialog({
        title: 'Failed to Add Source',
        message:
          err instanceof Error
            ? err.message
            : 'Could not fetch or validate manifest.json from this source.',
        variant: 'error',
      });
    } finally {
      setAddingSource(false);
    }
  };

  const handleRemoveSource = (author: string) => {
    showAppDialog({
      title: 'Remove Provider Source',
      message: `Remove "${author}" from your provider sources? Installed providers from this source will remain until uninstalled.`,
      variant: 'warning',
      actions: [
        {label: 'Cancel', variant: 'secondary'},
        {
          label: 'Remove',
          variant: 'destructive',
          onPress: () => {
            extensionStorage.removeProviderSource(author);
            sourceTokenStorage.deleteToken(author);
            const updated = extensionStorage.getProviderSources();
            setSources(updated);
            syncAvailableProvidersFromStorage(updated);
            if (selectedSourceFilter.toLowerCase() === author.toLowerCase()) {
              setSelectedSourceFilter('all');
            }
          },
        },
      ],
    });
  };

  const cardKey = (p: ProviderExtension) =>
    `${p.source?.author || 'default'}:${p.value}`;

  const handleInstallProvider = async (provider: ProviderExtension) => {
    const key = cardKey(provider);
    setInstallingMap(prev => ({...prev, [key]: true}));
    try {
      await extensionManager.installProvider(provider);
      const updatedInstalled = extensionStorage.getInstalledProviders();
      setInstalledProviders(updatedInstalled);
      if (!activeExtensionProvider?.value) {
        setActiveExtensionProvider(provider);
      }
      await queryClient.invalidateQueries({queryKey: ['homePageData']});
    } catch (err) {
      showAppDialog({
        title: 'Installation Failed',
        message:
          err instanceof Error
            ? err.message
            : `Failed to install ${provider.display_name}`,
        variant: 'error',
      });
    } finally {
      setInstallingMap(prev => ({...prev, [key]: false}));
    }
  };

  const handleUpdateProvider = async (provider: ProviderExtension) => {
    const key = cardKey(provider);
    setInstallingMap(prev => ({...prev, [key]: true}));
    try {
      const ok = await extensionManager.updateProvider(provider);
      if (ok) {
        const updatedInstalled = extensionStorage.getInstalledProviders();
        setInstalledProviders(updatedInstalled);
        if (activeExtensionProvider?.value === provider.value) {
          const refreshed = updatedInstalled.find(
            p => p.value === provider.value,
          );
          if (refreshed) setActiveExtensionProvider(refreshed);
        }
        await queryClient.invalidateQueries({queryKey: ['homePageData']});
      }
    } finally {
      setInstallingMap(prev => ({...prev, [key]: false}));
    }
  };

  const handleUninstallProvider = (provider: ProviderExtension) => {
    showAppDialog({
      title: 'Uninstall Provider',
      message: `Are you sure you want to uninstall ${provider.display_name}?`,
      variant: 'warning',
      actions: [
        {label: 'Cancel', variant: 'secondary'},
        {
          label: 'Uninstall',
          variant: 'destructive',
          onPress: () => {
            extensionManager.uninstallProvider(
              provider.value,
              provider.source?.author,
            );
            const updatedInstalled = extensionStorage.getInstalledProviders();
            setInstalledProviders(updatedInstalled);
            if (activeExtensionProvider?.value === provider.value) {
              setActiveExtensionProvider(
                updatedInstalled[0] || {
                  value: '',
                  display_name: '',
                  type: 'global',
                  installed: false,
                  disabled: false,
                  version: '0.0.1',
                  icon: '',
                  source: {author: '', url: ''},
                },
              );
            }
          },
        },
      ],
    });
  };

  const handleTestProvider = async (provider: ProviderExtension) => {
    setTestingProvider(provider);
    setTestEvents({});
    const res = await testProvider(provider, ev => {
      setTestEvents(prev => ({...prev, [ev.stageName]: ev}));
    });
    setTestingProvider(null);

    if (res.cancelled) return;

    if (res.passed) {
      showAppDialog({
        title: `${provider.display_name} Passed`,
        message: `All 5 stages (Catalog, Posts, Metadata, Episodes/Links, Streams) succeeded.`,
        variant: 'success',
      });
    } else {
      showAppDialog({
        title: `${provider.display_name} Failed`,
        message: `Failed at stage "${res.failedStage || 'Unknown'}":\n${res.reason || 'Unknown error'}`,
        variant: 'error',
      });
    }
  };

  const providersNeedingUpdate = useMemo(() => {
    return extensionStorage.getProvidersNeedingUpdate();
  }, [installedProviders, availableProviders]);

  const handleUpdateAll = async () => {
    if (providersNeedingUpdate.length === 0) return;
    setUpdatingAll(true);
    try {
      for (const installed of providersNeedingUpdate) {
        const latest = availableProviders.find(
          a =>
            a.value === installed.value &&
            isSameSource(a.source, installed.source),
        );
        if (latest) {
          await extensionManager.updateProvider(latest);
        }
      }
      setInstalledProviders(extensionStorage.getInstalledProviders());
      await queryClient.invalidateQueries({queryKey: ['homePageData']});
    } finally {
      setUpdatingAll(false);
    }
  };

  const baseList =
    activeTab === 'installed' ? installedProviders : availableProviders;

  const categories = useMemo(() => {
    const types = new Set<string>();
    baseList.forEach(p => {
      if (p.type) types.add(p.type.toLowerCase());
      if (p.category) types.add(p.category.toLowerCase());
    });
    return ['all', ...Array.from(types)];
  }, [baseList]);

  const filteredProviders = useMemo(() => {
    return baseList.filter(p => {
      if (!p || !p.value || p.disabled) return false;
      if (
        selectedSourceFilter !== 'all' &&
        p.source?.author?.toLowerCase() !== selectedSourceFilter.toLowerCase()
      ) {
        return false;
      }
      if (selectedCategory !== 'all') {
        const matchType = p.type?.toLowerCase() === selectedCategory;
        const matchCat = p.category?.toLowerCase() === selectedCategory;
        if (!matchType && !matchCat) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.display_name?.toLowerCase().includes(q) ||
          p.value.toLowerCase().includes(q) ||
          p.source?.author?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [baseList, selectedSourceFilter, selectedCategory, searchQuery]);

  return (
    <div
      className="flex-1 min-h-screen pb-24 sm:pb-12 overflow-y-auto select-none"
      style={{backgroundColor: colors.background}}>
      {/* Top Bar */}
      <div
        className="sticky top-0 z-20 px-4 py-3.5 border-b flex items-center justify-between gap-3"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.outlineVariant,
        }}>
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            style={{color: colors.onSurface}}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1
              className="text-lg font-bold tracking-tight"
              style={{color: colors.onSurface}}>
              Provider Manager
            </h1>
            <p
              className="text-xs"
              style={{color: colors.onSurfaceVariant}}>
              Manage sources, install extensions, and test providers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {providersNeedingUpdate.length > 0 && (
            <button
              onClick={handleUpdateAll}
              disabled={updatingAll}
              className="px-3.5 py-2 rounded-full flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              style={{
                backgroundColor: colors.primary,
                color: colors.onPrimary,
              }}>
              <ArrowUpCircle size={15} />
              <span>
                {updatingAll
                  ? 'Updating...'
                  : `Update All (${providersNeedingUpdate.length})`}
              </span>
            </button>
          )}

          <button
            onClick={() => handleRefreshManifests(true)}
            disabled={refreshing}
            className="p-2.5 rounded-full border hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
              color: colors.onSurface,
            }}
            title="Refresh provider manifests">
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4">
        {/* Provider Sources Card */}
        <div
          className="p-4 rounded-2xl border mb-4"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Layers size={17} style={{color: colors.primary}} />
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{color: colors.onSurface}}>
                Provider Sources ({sources.length})
              </span>
            </div>

            <button
              onClick={() => setAddSourceModalOpen(true)}
              className="px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              style={{
                backgroundColor: colors.primary,
                color: colors.onPrimary,
              }}>
              <Plus size={14} />
              <span>Add Source</span>
            </button>
          </div>

          {sources.length === 0 ? (
            <p
              className="text-xs py-2"
              style={{color: colors.onSurfaceVariant}}>
              No provider sources configured. Click "Add Source" and enter a
              GitHub provider repo author (e.g. Zenda-Cross) or manifest URL.
            </p>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedSourceFilter('all')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border shrink-0 cursor-pointer"
                style={{
                  backgroundColor:
                    selectedSourceFilter === 'all'
                      ? colors.secondaryContainer
                      : colors.surfaceContainerHigh,
                  borderColor:
                    selectedSourceFilter === 'all'
                      ? colors.secondaryContainer
                      : colors.outlineVariant,
                  color:
                    selectedSourceFilter === 'all'
                      ? colors.onSecondaryContainer
                      : colors.onSurfaceVariant,
                }}>
                All Sources
              </button>

              {sources.map(src => {
                const isSelected =
                  selectedSourceFilter.toLowerCase() ===
                  src.author.toLowerCase();
                return (
                  <div
                    key={src.author}
                    className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-xl border shrink-0"
                    style={{
                      backgroundColor: isSelected
                        ? colors.secondaryContainer
                        : colors.surfaceContainerHigh,
                      borderColor: isSelected
                        ? colors.secondaryContainer
                        : colors.outlineVariant,
                      color: isSelected
                        ? colors.onSecondaryContainer
                        : colors.onSurface,
                    }}>
                    <button
                      onClick={() => setSelectedSourceFilter(src.author)}
                      className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      {src.isPrivate ? (
                        <Lock size={12} />
                      ) : (
                        <Globe size={12} />
                      )}
                      <span>{src.author}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveSource(src.author)}
                      className="p-1 rounded-full hover:bg-black/20 cursor-pointer opacity-75 hover:opacity-100"
                      title={`Remove ${src.author}`}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Installed vs Available Segmented Tabs */}
        <div
          className="grid grid-cols-2 p-1 rounded-2xl border mb-4"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <button
            onClick={() => setActiveTab('installed')}
            className="py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            style={{
              backgroundColor:
                activeTab === 'installed' ? colors.primary : 'transparent',
              color:
                activeTab === 'installed'
                  ? colors.onPrimary
                  : colors.onSurfaceVariant,
            }}>
            Installed ({installedProviders.length})
          </button>

          <button
            onClick={() => setActiveTab('available')}
            className="py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            style={{
              backgroundColor:
                activeTab === 'available' ? colors.primary : 'transparent',
              color:
                activeTab === 'available'
                  ? colors.onPrimary
                  : colors.onSurfaceVariant,
            }}>
            Available ({availableProviders.length})
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="mb-4 space-y-2.5">
          <div
            className="flex items-center h-11 px-3.5 rounded-2xl border"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            }}>
            <Search
              size={17}
              className="mr-2.5 shrink-0"
              style={{color: colors.onSurfaceVariant}}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab} providers...`}
              className="w-full bg-transparent text-xs sm:text-sm outline-none"
              style={{color: colors.onSurface}}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full hover:bg-white/10 cursor-pointer"
                style={{color: colors.onSurfaceVariant}}>
                <X size={15} />
              </button>
            )}
          </div>

          {categories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {categories.map(cat => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold capitalize border shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: active
                        ? colors.secondaryContainer
                        : colors.surfaceContainerLow,
                      borderColor: active
                        ? colors.secondaryContainer
                        : colors.outlineVariant,
                      color: active
                        ? colors.onSecondaryContainer
                        : colors.onSurfaceVariant,
                    }}>
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Provider Cards List */}
        {refreshing && filteredProviders.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin mb-3"
              style={{color: colors.primary}}
            />
            <p className="text-xs" style={{color: colors.onSurfaceVariant}}>
              Fetching provider manifest...
            </p>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div
            className="p-10 rounded-3xl border text-center my-4"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            }}>
            <p
              className="text-sm font-semibold mb-1"
              style={{color: colors.onSurface}}>
              {activeTab === 'installed'
                ? 'No providers installed yet'
                : 'No providers match your filter'}
            </p>
            <p
              className="text-xs mb-4"
              style={{color: colors.onSurfaceVariant}}>
              {activeTab === 'installed'
                ? 'Switch to the "Available" tab to install providers from Zenda-Cross or another added source.'
                : 'Try refreshing manifests or adding another provider source.'}
            </p>
            {activeTab === 'installed' && (
              <button
                onClick={() => setActiveTab('available')}
                className="px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                }}>
                Browse Available Providers
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredProviders.map(item => {
              const key = cardKey(item);
              const isInstalled = installedProviders.some(
                inst =>
                  inst.value === item.value &&
                  isSameSource(inst.source, item.source),
              );
              const installedEntry = installedProviders.find(
                inst =>
                  inst.value === item.value &&
                  isSameSource(inst.source, item.source),
              );
              const availableEntry = availableProviders.find(
                avail =>
                  avail.value === item.value &&
                  isSameSource(avail.source, item.source),
              );
              const hasUpdate =
                Boolean(installedEntry && availableEntry) &&
                installedEntry!.version !== availableEntry!.version;

              const isBusy = Boolean(installingMap[key]);
              const isActive =
                activeExtensionProvider?.value === item.value &&
                (!activeExtensionProvider?.source?.author ||
                  activeExtensionProvider?.source?.author ===
                    item.source?.author);

              const hasSettings =
                isInstalled &&
                providerManager.hasProviderSettings(
                  item.value,
                  item.source?.author,
                );

              return (
                <div
                  key={key}
                  onClick={() => {
                    if (isInstalled) {
                      setActiveExtensionProvider(installedEntry || item);
                    }
                  }}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                    isInstalled ? 'cursor-pointer hover:bg-white/[0.02]' : ''
                  }`}
                  style={{
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: isActive
                      ? colors.primary
                      : colors.outlineVariant,
                  }}>
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {item.icon ? (
                      <img
                        src={item.icon}
                        alt={item.display_name}
                        className="w-11 h-11 rounded-xl object-cover shrink-0 bg-black/40 border border-white/10"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: colors.surfaceContainerHighest,
                        }}>
                        <Film size={20} style={{color: colors.primary}} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-sm font-bold truncate"
                          style={{color: colors.onSurface}}>
                          {item.display_name}
                        </span>
                        {isActive && isInstalled && (
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                            style={{
                              backgroundColor: colors.primary,
                              color: colors.onPrimary,
                            }}>
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                          style={{
                            backgroundColor: colors.surfaceContainerHigh,
                            color: colors.onSurfaceVariant,
                          }}>
                          v{item.version}
                        </span>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-md font-medium capitalize"
                          style={{
                            backgroundColor: colors.surfaceContainerHigh,
                            color: colors.onSurfaceVariant,
                          }}>
                          {item.type || 'global'}
                        </span>
                        {item.category && (
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                            style={{
                              backgroundColor: colors.surfaceContainerHigh,
                              color: colors.onSurfaceVariant,
                            }}>
                            {item.category}
                          </span>
                        )}
                        {item.source?.author && (
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                            style={{
                              backgroundColor: colors.secondaryContainer,
                              color: colors.onSecondaryContainer,
                            }}>
                            {item.source.author}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Provider Card Actions */}
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={e => e.stopPropagation()}>
                    {hasSettings && (
                      <button
                        onClick={() => setSettingsProvider(item)}
                        className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-white/10 cursor-pointer"
                        style={{
                          backgroundColor: colors.surfaceContainerHigh,
                          borderColor: colors.outlineVariant,
                          color: colors.onSurfaceVariant,
                        }}
                        title="Provider Settings">
                        <SlidersHorizontal size={15} />
                      </button>
                    )}

                    <button
                      onClick={() => handleTestProvider(item)}
                      className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-white/10 cursor-pointer"
                      style={{
                        backgroundColor: colors.surfaceContainerHigh,
                        borderColor: colors.outlineVariant,
                        color: colors.onSurfaceVariant,
                      }}
                      title="Run diagnostic test">
                      <Activity size={15} />
                    </button>

                    {hasUpdate && availableEntry && (
                      <button
                        onClick={() => handleUpdateProvider(availableEntry)}
                        disabled={isBusy}
                        className="px-3.5 h-9 rounded-full flex items-center gap-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                        style={{
                          backgroundColor: colors.primary,
                          color: colors.onPrimary,
                        }}>
                        {isBusy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <RefreshCw size={13} />
                            <span>v{availableEntry.version}</span>
                          </>
                        )}
                      </button>
                    )}

                    {activeTab === 'installed' ? (
                      <button
                        onClick={() => handleUninstallProvider(item)}
                        className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                        style={{
                          backgroundColor: colors.errorContainer,
                          color: colors.onErrorContainer,
                        }}
                        title="Uninstall provider">
                        <Trash2 size={15} />
                      </button>
                    ) : isInstalled ? (
                      <div
                        className="px-3.5 h-9 rounded-full flex items-center gap-1.5 text-xs font-semibold border"
                        style={{
                          backgroundColor: colors.secondaryContainer,
                          borderColor: colors.outlineVariant,
                          color: colors.onSecondaryContainer,
                        }}>
                        <Check size={14} />
                        <span>Installed</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleInstallProvider(item)}
                        disabled={isBusy}
                        className="px-4 h-9 rounded-full flex items-center gap-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                        style={{
                          backgroundColor: colors.primary,
                          color: colors.onPrimary,
                        }}>
                        {isBusy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <Download size={14} />
                            <span>Install</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Source Modal */}
      {addSourceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{backgroundColor: 'rgba(0,0,0,0.75)'}}
          onClick={() => !addingSource && setAddSourceModalOpen(false)}>
          <div
            className="w-full max-w-md rounded-3xl p-6 border shadow-2xl"
            style={{
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
            }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-lg font-bold"
                style={{color: colors.onSurface}}>
                Add Provider Source
              </h3>
              <button
                onClick={() => setAddSourceModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
                style={{color: colors.onSurfaceVariant}}>
                <X size={18} />
              </button>
            </div>

            <p
              className="text-xs leading-relaxed mb-4"
              style={{color: colors.onSurfaceVariant}}>
              Enter a GitHub author shorthand (e.g.{' '}
              <code className="px-1.5 py-0.5 rounded bg-black/30">
                Zenda-Cross
              </code>
              , <code className="px-1.5 py-0.5 rounded bg-black/30">user@cb</code>
              ) or a full repository / manifest.json URL.
            </p>

            <input
              type="text"
              value={newSourceInput}
              onChange={e => setNewSourceInput(e.target.value)}
              placeholder="e.g. Zenda-Cross or https://.../manifest.json"
              className="w-full h-11 px-4 rounded-xl border text-sm outline-none mb-3"
              style={{
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
                color: colors.onSurface,
              }}
            />

            <label className="flex items-center gap-2.5 text-xs font-medium mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newSourcePrivate}
                onChange={e => setNewSourcePrivate(e.target.checked)}
              />
              <span style={{color: colors.onSurface}}>
                Private Repository (requires access token)
              </span>
            </label>

            {newSourcePrivate && (
              <input
                type="password"
                value={newSourceToken}
                onChange={e => setNewSourceToken(e.target.value)}
                placeholder="GitHub / GitLab Personal Access Token"
                className="w-full h-11 px-4 rounded-xl border text-sm outline-none mb-4"
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                }}
              />
            )}

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setAddSourceModalOpen(false)}
                disabled={addingSource}
                className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                style={{color: colors.onSurfaceVariant}}>
                Cancel
              </button>
              <button
                onClick={handleAddSource}
                disabled={addingSource || !newSourceInput.trim()}
                className="px-5 py-2 rounded-full text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                }}>
                {addingSource && <Loader2 size={14} className="animate-spin" />}
                <span>{addingSource ? 'Validating...' : 'Validate & Add'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Progress Modal */}
      <ProviderTestProgressDialog
        visible={Boolean(testingProvider)}
        providerName={testingProvider?.display_name}
        events={testEvents}
        onCancel={() => extensionManager.cancelDiagnosticTest()}
      />

      {/* Provider Settings Modal */}
      <ProviderSettingsModal
        visible={Boolean(settingsProvider)}
        provider={settingsProvider}
        onClose={() => setSettingsProvider(null)}
        onSettingsChanged={() => {
          queryClient.invalidateQueries({queryKey: ['homePageData']});
        }}
      />
    </div>
  );
};
