import React, {useState, useEffect} from 'react';
import {X, RotateCcw, Loader2} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {ProviderExtension} from '../lib/storage';
import {ProviderSettingItem} from '../lib/providers/types';
import {providerManager} from '../lib/services/ProviderManager';
import {showAppDialog} from '../lib/zustand/appDialogStore';

interface ProviderSettingsModalProps {
  visible: boolean;
  provider: ProviderExtension | null;
  onClose: () => void;
  onSettingsChanged?: () => void;
}

export const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({
  visible,
  provider,
  onClose,
  onSettingsChanged,
}) => {
  const colors = useM3Colors();
  const [schema, setSchema] = useState<ProviderSettingItem[]>([]);
  const [values, setValues] = useState<
    Record<string, boolean | string | string[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [runningActionKey, setRunningActionKey] = useState<string | null>(null);

  const loadSchema = async () => {
    if (!provider) return;
    setLoading(true);
    try {
      const items = await providerManager.getSettingsSchema({
        providerValue: provider.value,
        sourceAuthor: provider.source?.author,
      });
      setSchema(items);
      const initialVals: Record<string, boolean | string | string[]> = {};
      items.forEach(item => {
        if (item.type !== 'action') {
          initialVals[item.key] = providerManager.getSettingValue(
            provider.value,
            item,
            provider.source?.author,
          );
        }
      });
      setValues(initialVals);
    } catch (err) {
      console.error('Failed to load provider settings schema:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && provider) {
      loadSchema();
    }
  }, [visible, provider]);

  if (!visible || !provider) return null;

  const handleUpdateValue = (
    item: ProviderSettingItem,
    newVal: boolean | string | string[],
  ) => {
    providerManager.setSettingValue(
      provider.value,
      item,
      newVal,
      provider.source?.author,
    );
    setValues(prev => ({...prev, [item.key]: newVal}));
    onSettingsChanged?.();
  };

  const handleAction = async (item: ProviderSettingItem) => {
    setRunningActionKey(item.key);
    try {
      const res = await providerManager.onSettingsAction({
        providerValue: provider.value,
        key: item.key,
        sourceAuthor: provider.source?.author,
      });
      if (res?.message) {
        showAppDialog({
          title: provider.display_name,
          message: res.message,
          variant: 'success',
        });
      }
      if (res?.refresh) {
        await loadSchema();
      }
      onSettingsChanged?.();
    } catch (err) {
      showAppDialog({
        title: 'Action Failed',
        message: err instanceof Error ? err.message : 'Action failed',
        variant: 'error',
      });
    } finally {
      setRunningActionKey(null);
    }
  };

  const handleReset = async () => {
    await providerManager.resetSettings(
      provider.value,
      provider.source?.author,
    );
    await loadSchema();
    onSettingsChanged?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{backgroundColor: 'rgba(0,0,0,0.75)'}}
      onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl p-6 border shadow-2xl max-h-[85vh] flex flex-col"
        style={{
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
        }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3
              className="text-lg font-bold"
              style={{color: colors.onSurface}}>
              {provider.display_name} Settings
            </h3>
            <p
              className="text-xs"
              style={{color: colors.onSurfaceVariant}}>
              v{provider.version} • {provider.source?.author}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 cursor-pointer"
            style={{color: colors.onSurfaceVariant}}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2
                size={24}
                className="animate-spin"
                style={{color: colors.primary}}
              />
            </div>
          ) : schema.length === 0 ? (
            <p
              className="text-sm py-8 text-center"
              style={{color: colors.onSurfaceVariant}}>
              No configurable settings exposed by this provider.
            </p>
          ) : (
            schema.map(item => (
              <div
                key={item.key}
                className="p-3.5 rounded-2xl border"
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                }}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span
                    className="text-sm font-semibold"
                    style={{color: colors.onSurface}}>
                    {item.label}
                  </span>

                  {item.type === 'toggle' && (
                    <input
                      type="checkbox"
                      checked={Boolean(values[item.key])}
                      onChange={e => handleUpdateValue(item, e.target.checked)}
                      className="w-4 h-4 accent-white cursor-pointer"
                    />
                  )}

                  {item.type === 'action' && (
                    <button
                      onClick={() => handleAction(item)}
                      disabled={runningActionKey === item.key}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer disabled:opacity-50"
                      style={{
                        backgroundColor: colors.primary,
                        color: colors.onPrimary,
                      }}>
                      {runningActionKey === item.key
                        ? 'Running...'
                        : item.buttonLabel || 'Run'}
                    </button>
                  )}
                </div>

                {item.description && (
                  <p
                    className="text-xs mb-2"
                    style={{color: colors.onSurfaceVariant}}>
                    {item.description}
                  </p>
                )}

                {item.type === 'text' && (
                  <input
                    type={item.secret ? 'password' : 'text'}
                    value={String(values[item.key] ?? '')}
                    placeholder={item.placeholder || ''}
                    onChange={e => handleUpdateValue(item, e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border text-xs outline-none mt-1"
                    style={{
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: colors.outlineVariant,
                      color: colors.onSurface,
                    }}
                  />
                )}

                {item.type === 'select' && (
                  <select
                    value={String(values[item.key] ?? '')}
                    onChange={e => handleUpdateValue(item, e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border text-xs outline-none mt-1"
                    style={{
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: colors.outlineVariant,
                      color: colors.onSurface,
                    }}>
                    {item.options.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}

                {item.type === 'multiselect' && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {item.options.map(opt => {
                      const currentArr = Array.isArray(values[item.key])
                        ? (values[item.key] as string[])
                        : [];
                      const selected = currentArr.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const next = selected
                              ? currentArr.filter(v => v !== opt.value)
                              : [...currentArr, opt.value];
                            handleUpdateValue(item, next);
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer"
                          style={{
                            backgroundColor: selected
                              ? colors.secondaryContainer
                              : colors.surfaceContainerHigh,
                            borderColor: selected
                              ? colors.secondaryContainer
                              : colors.outlineVariant,
                            color: selected
                              ? colors.onSecondaryContainer
                              : colors.onSurfaceVariant,
                          }}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{borderColor: colors.outlineVariant}}>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              color: colors.onSurfaceVariant,
            }}>
            <RotateCcw size={13} />
            <span>Reset defaults</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-xs font-bold cursor-pointer"
            style={{
              backgroundColor: colors.primary,
              color: colors.onPrimary,
            }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
