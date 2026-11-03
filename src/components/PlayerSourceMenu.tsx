import React, {useRef} from 'react';
import {Check, FolderOpen, X, Loader2} from 'lucide-react';
import {Stream} from '../lib/providers/types';
import {useM3Colors} from '../theme/M3PaletteContext';

export interface QualityOption {
  id: number; // -1 for Auto
  label: string;
  detail?: string;
}

interface PlayerSourceMenuProps {
  visible: boolean;
  streams: Stream[];
  selectedStream: Stream;
  isLoading: boolean;
  qualityOptions: QualityOption[];
  selectedQualityId: number;
  onSelectStream: (stream: Stream) => void;
  onSelectQuality: (levelId: number) => void;
  onPickLocalFile: (file: File) => void;
  onClose: () => void;
}

export const PlayerSourceMenu: React.FC<PlayerSourceMenuProps> = ({
  visible,
  streams,
  selectedStream,
  isLoading,
  qualityOptions,
  selectedQualityId,
  onSelectStream,
  onSelectQuality,
  onPickLocalFile,
  onClose,
}) => {
  const colors = useM3Colors();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{backgroundColor: 'rgba(0,0,0,0.72)'}}
      onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
        style={{
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
        }}
        onClick={e => e.stopPropagation()}>
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between"
          style={{borderColor: colors.outlineVariant}}>
          <h3
            className="text-base font-bold"
            style={{color: colors.onSurface}}>
            Servers & Quality
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
            style={{color: colors.onSurfaceVariant}}>
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x flex-1 overflow-hidden" style={{borderColor: colors.outlineVariant}}>
          {/* Left Column: Servers / Streams */}
          <div className="p-4 flex flex-col overflow-hidden">
            <span
              className="text-xs font-bold uppercase tracking-wider mb-2.5"
              style={{color: colors.primary}}>
              Server / Source ({streams.length})
            </span>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoading ? (
                <div className="py-10 flex justify-center">
                  <Loader2
                    size={24}
                    className="animate-spin"
                    style={{color: colors.primary}}
                  />
                </div>
              ) : (
                streams.map((item, i) => {
                  const isSelected =
                    item.link === selectedStream.link &&
                    item.server === selectedStream.server;
                  const metaBadges = [
                    item.quality ? `${item.quality}p` : null,
                    item.type ? item.type.toUpperCase() : null,
                    ...(item.tags || []),
                  ].filter(Boolean);

                  return (
                    <button
                      key={`${item.server}-${item.link}-${i}`}
                      onClick={() => {
                        onSelectStream(item);
                        onClose();
                      }}
                      className="w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      style={{
                        backgroundColor: isSelected
                          ? colors.secondaryContainer
                          : colors.surfaceContainerLow,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.outlineVariant,
                      }}>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-bold truncate"
                          style={{
                            color: isSelected
                              ? colors.onSecondaryContainer
                              : colors.onSurface,
                          }}>
                          {item.server || `Source ${i + 1}`}
                        </p>
                        {metaBadges.length > 0 && (
                          <p
                            className="text-[11px] mt-0.5 truncate"
                            style={{
                              color: isSelected
                                ? colors.onSecondaryContainer
                                : colors.onSurfaceVariant,
                            }}>
                            {metaBadges.join(' • ')}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <Check
                          size={16}
                          style={{color: colors.onSecondaryContainer}}
                        />
                      )}
                    </button>
                  );
                })
              )}

              {/* Local Video File Option */}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-colors hover:bg-white/5 cursor-pointer"
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                }}>
                <FolderOpen size={17} style={{color: colors.primary}} />
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{color: colors.onSurface}}>
                    Local file...
                  </p>
                  <p
                    className="text-[11px]"
                    style={{color: colors.onSurfaceVariant}}>
                    Play video from this device
                  </p>
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="video/*,.mkv,.mp4,.webm"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onPickLocalFile(file);
                    onClose();
                  }
                }}
              />
            </div>
          </div>

          {/* Right Column: Quality Tracks */}
          <div className="p-4 flex flex-col overflow-hidden">
            <span
              className="text-xs font-bold uppercase tracking-wider mb-2.5"
              style={{color: colors.primary}}>
              Stream Quality
            </span>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {qualityOptions.length <= 1 ? (
                <div
                  className="p-4 rounded-2xl border text-center"
                  style={{
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  }}>
                  <p
                    className="text-xs font-medium"
                    style={{color: colors.onSurfaceVariant}}>
                    {selectedStream.quality
                      ? `Direct ${selectedStream.quality}p stream (select another server on the left to switch resolution)`
                      : 'Adaptive / Direct stream'}
                  </p>
                </div>
              ) : (
                qualityOptions.map(q => {
                  const active = selectedQualityId === q.id;
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        onSelectQuality(q.id);
                        onClose();
                      }}
                      className="w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-2 cursor-pointer"
                      style={{
                        backgroundColor: active
                          ? colors.secondaryContainer
                          : colors.surfaceContainerLow,
                        borderColor: active
                          ? colors.primary
                          : colors.outlineVariant,
                      }}>
                      <div>
                        <p
                          className="text-sm font-bold"
                          style={{
                            color: active
                              ? colors.onSecondaryContainer
                              : colors.onSurface,
                          }}>
                          {q.label}
                        </p>
                        {q.detail && (
                          <p
                            className="text-[11px]"
                            style={{
                              color: active
                                ? colors.onSecondaryContainer
                                : colors.onSurfaceVariant,
                            }}>
                            {q.detail}
                          </p>
                        )}
                      </div>
                      {active && (
                        <Check
                          size={16}
                          style={{color: colors.onSecondaryContainer}}
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
