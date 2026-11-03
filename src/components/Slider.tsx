import React from 'react';
import {Post} from '../lib/providers/types';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation} from '../NavigationContext';
import useContentStore from '../lib/zustand/contentStore';

interface SliderProps {
  isLoading: boolean;
  title: string;
  posts: Post[];
  filter: string;
  providerValue?: string;
  isSearch?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  isLoading,
  title,
  posts,
  filter,
  providerValue,
  isSearch = false,
}) => {
  const colors = useM3Colors();
  const {navigate} = useVegaNavigation();
  const {provider} = useContentStore();

  const targetProvider = providerValue || provider.value;

  return (
    <div className="px-4 pt-3 pb-1 select-none">
      <div className="flex items-center justify-between mb-2.5">
        <h3
          className="text-lg font-semibold tracking-tight truncate pr-3"
          style={{color: colors.onSurface}}>
          {title}
        </h3>
        {filter !== 'recent' && (
          <button
            onClick={() =>
              navigate({
                name: 'ScrollList',
                params: {
                  title,
                  filter,
                  providerValue: targetProvider,
                  isSearch,
                },
              })
            }
            className="px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:bg-white/10 cursor-pointer shrink-0"
            style={{color: colors.primary}}>
            See all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 overflow-x-hidden py-1">
          {Array.from({length: 7}).map((_, idx) => (
            <div key={idx} className="w-[112px] shrink-0 animate-pulse">
              <div
                className="w-[112px] h-[166px] rounded-xl mb-2"
                style={{backgroundColor: colors.surfaceContainerHighest}}
              />
              <div
                className="w-20 h-3 rounded"
                style={{backgroundColor: colors.surfaceContainerHigh}}
              />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs" style={{color: colors.onSurfaceVariant}}>
            No content available
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 overflow-x-auto pb-2 no-scrollbar">
          {posts.map((item, idx) => (
            <button
              key={`${item.link}-${idx}`}
              onClick={() =>
                navigate({
                  name: 'Info',
                  params: {
                    link: item.link,
                    provider: item.provider || targetProvider,
                    poster: item.image,
                  },
                })
              }
              className="w-[112px] shrink-0 text-left group cursor-pointer focus:outline-none">
              <div
                className="w-[112px] h-[166px] rounded-xl overflow-hidden border transition-transform duration-200 group-hover:scale-[1.03]"
                style={{
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: 'rgba(255,255,255,0.06)',
                }}>
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://placehold.jp/24/262626/999999/300x450.png?text=Poster';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs opacity-50">
                    {item.title}
                  </div>
                )}
              </div>
              <p
                className="text-xs mt-1.5 line-clamp-2 leading-snug font-medium"
                style={{color: colors.onSurface}}>
                {item.title}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
