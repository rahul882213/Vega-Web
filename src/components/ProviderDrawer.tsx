import React from 'react';
import {Film, ArrowUp, ArrowDown, X, Layers} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import useContentStore from '../lib/zustand/contentStore';
import {useVegaNavigation} from '../NavigationContext';
import {settingsStorage, ProviderExtension} from '../lib/storage';
import {providerOrderKey} from '../lib/providerOrder';

export const ProviderDrawer: React.FC = () => {
  const colors = useM3Colors();
  const {isDrawerOpen, closeDrawer, navigate} = useVegaNavigation();
  const {provider, setProvider, installedProviders, setInstalledProviders} =
    useContentStore();

  if (!isDrawerOpen) return null;

  const moveProvider = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= installedProviders.length) return;
    const next = [...installedProviders];
    const [item] = next.splice(index, 1);
    next.splice(targetIdx, 0, item);
    settingsStorage.setProviderOrder(next.map(providerOrderKey));
    setInstalledProviders(next);
  };

  const handleSelect = (item: ProviderExtension) => {
    setProvider(item);
    closeDrawer();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{backgroundColor: 'rgba(0,0,0,0.65)'}}
      onClick={closeDrawer}>
      <div
        className="w-80 max-w-[85vw] h-full flex flex-col border-r shadow-2xl"
        style={{
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
        }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div
          className="px-5 pt-6 pb-4 border-b flex items-start justify-between"
          style={{borderColor: colors.outlineVariant}}>
          <div>
            <h2
              className="text-xl font-bold tracking-tight"
              style={{color: colors.onSurface}}>
              Select Provider
            </h2>
            <p
              className="text-xs mt-1"
              style={{color: colors.onSurfaceVariant}}>
              Content source • Reorder with arrows
            </p>
          </div>
          <button
            onClick={closeDrawer}
            className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            style={{color: colors.onSurfaceVariant}}>
            <X size={18} />
          </button>
        </div>

        {/* Provider List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {installedProviders.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <p
                className="text-sm mb-4"
                style={{color: colors.onSurfaceVariant}}>
                No providers installed yet.
              </p>
              <button
                onClick={() => {
                  closeDrawer();
                  navigate({name: 'Extensions'});
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                }}>
                Open Provider Manager
              </button>
            </div>
          ) : (
            installedProviders.map((item, idx) => {
              const isSelected =
                provider.value === item.value &&
                (!provider.source?.author ||
                  provider.source?.author === item.source?.author);
              return (
                <div
                  key={`${item.source?.author || 'default'}:${item.value}`}
                  onClick={() => handleSelect(item)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-full transition-colors cursor-pointer"
                  style={{
                    backgroundColor: isSelected
                      ? colors.secondaryContainer
                      : 'transparent',
                    color: isSelected
                      ? colors.onSecondaryContainer
                      : colors.onSurface,
                  }}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.icon ? (
                      <img
                        src={item.icon}
                        alt={item.display_name}
                        className="w-7 h-7 rounded-full object-cover shrink-0 bg-black/30"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{backgroundColor: colors.surfaceContainerHighest}}>
                        <Film size={15} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm truncate"
                        style={{fontWeight: isSelected ? 600 : 400}}>
                        {item.display_name}
                      </p>
                      <p
                        className="text-[11px] truncate opacity-75"
                        style={{
                          color: isSelected
                            ? colors.onSecondaryContainer
                            : colors.onSurfaceVariant,
                        }}>
                        {item.type || 'global'}
                        {item.source?.author ? ` • ${item.source.author}` : ''}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-0.5 ml-2 shrink-0"
                    onClick={e => e.stopPropagation()}>
                    <button
                      disabled={idx === 0}
                      onClick={() => moveProvider(idx, -1)}
                      className="p-1 rounded-full hover:bg-black/20 disabled:opacity-25 cursor-pointer"
                      title="Move up">
                      <ArrowUp size={14} />
                    </button>
                    <button
                      disabled={idx === installedProviders.length - 1}
                      onClick={() => moveProvider(idx, 1)}
                      className="p-1 rounded-full hover:bg-black/20 disabled:opacity-25 cursor-pointer"
                      title="Move down">
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer link to Provider Manager */}
        <div
          className="p-3 border-t"
          style={{borderColor: colors.outlineVariant}}>
          <button
            onClick={() => {
              closeDrawer();
              navigate({name: 'Extensions'});
            }}
            className="w-full py-2.5 px-4 rounded-full flex items-center justify-center gap-2 text-xs font-semibold transition-colors cursor-pointer"
            style={{
              backgroundColor: colors.surfaceContainerHigh,
              color: colors.onSurface,
            }}>
            <Layers size={15} style={{color: colors.primary}} />
            <span>Manage Extensions</span>
          </button>
        </div>
      </div>
    </div>
  );
};
