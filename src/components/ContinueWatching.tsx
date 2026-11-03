import React from 'react';
import {Play, X} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import useContinueWatchingStore, {
  ContinueWatchingItem,
} from '../lib/zustand/continueWatchingStore';
import {useVegaNavigation} from '../NavigationContext';

export const ContinueWatching: React.FC = () => {
  const colors = useM3Colors();
  const {items, removeItem} = useContinueWatchingStore();
  const {navigate} = useVegaNavigation();

  if (!items || items.length === 0) return null;

  const handleResume = (item: ContinueWatchingItem) => {
    navigate({
      name: 'Player',
      params: {
        linkList: [item.episode],
        episodeIndex: 0,
        type: item.type,
        primaryTitle: item.title,
        secondaryTitle: item.episodeTitle,
        seasonTitle: item.seasonTitle,
        poster: {
          poster: item.poster,
          background: item.background,
        },
        providerValue: item.providerValue,
        infoUrl: item.infoUrl,
      },
    });
  };

  return (
    <div className="px-4 pt-4 pb-1 select-none">
      <div className="flex items-center justify-between mb-2.5">
        <h3
          className="text-lg font-semibold tracking-tight"
          style={{color: colors.onSurface}}>
          Continue Watching
        </h3>
      </div>

      <div className="flex items-start gap-3 overflow-x-auto pb-2 no-scrollbar">
        {items.map(item => {
          const pct =
            item.duration > 0
              ? Math.min(100, Math.max(4, (item.position / item.duration) * 100))
              : 0;
          return (
            <div
              key={item.id}
              className="w-[152px] shrink-0 group relative cursor-pointer"
              onClick={() => handleResume(item)}>
              <div
                className="w-[152px] h-[210px] rounded-xl overflow-hidden relative border"
                style={{
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}>
                {item.poster ? (
                  <img
                    src={item.poster}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-2 text-xs text-center opacity-60">
                    {item.title}
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex items-center justify-center">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
                    style={{
                      backgroundColor: colors.primary,
                      color: colors.onPrimary,
                    }}>
                    <Play size={16} fill="currentColor" />
                  </div>
                </div>

                <button
                  onClick={e => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
                  title="Remove from Continue Watching">
                  <X size={13} />
                </button>

                {/* Progress Bar */}
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25">
                  <div
                    className="h-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: colors.primary,
                    }}
                  />
                </div>
              </div>

              <p
                className="text-xs font-semibold mt-1.5 truncate"
                style={{color: colors.onSurface}}>
                {item.title}
              </p>
              {item.episodeTitle && (
                <p
                  className="text-[11px] truncate"
                  style={{color: colors.onSurfaceVariant}}>
                  {item.episodeTitle}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
