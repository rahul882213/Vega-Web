import React, {useState, useEffect, useRef} from 'react';
import {Menu, Search, Play, X} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation} from '../NavigationContext';
import useHeroStore from '../lib/zustand/herostore';
import useContentStore from '../lib/zustand/contentStore';
import {settingsStorage} from '../lib/storage';
import {useContentDetails} from '../lib/hooks/useContentInfo';
import {fetchImdbSuggestions, ImdbSuggestionItem} from '../lib/services/imdb';

interface HeroProps {
  isLoading: boolean;
}

const ROTATION_INTERVAL_MS = 8000;

export const Hero: React.FC<HeroProps> = ({isLoading}) => {
  const colors = useM3Colors();
  const {navigate, openDrawer} = useVegaNavigation();
  const {heroes} = useHeroStore();
  const {provider} = useContentStore();

  const [heroIndex, setHeroIndex] = useState(0);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ImdbSuggestionItem[]>([]);
  const [imageError, setImageError] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showHamburgerMenu = settingsStorage.showHamburgerMenu();

  useEffect(() => {
    setHeroIndex(0);
  }, [heroes]);

  useEffect(() => {
    if (heroes.length <= 1 || searchActive) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroes.length);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [heroes.length, searchActive]);

  const currentHero = heroes[heroIndex] || heroes[0];

  useEffect(() => {
    setImageError(false);
  }, [currentHero?.link]);

  const {info, meta, isLoading: heroDetailLoading} = useContentDetails(
    currentHero?.link || '',
    provider.value,
    provider.source?.author,
  );

  useEffect(() => {
    if (!searchActive || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchImdbSuggestions(searchQuery, controller.signal).then(items => {
        if (!controller.signal.aborted) {
          setSuggestions(items.slice(0, 6));
        }
      });
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, searchActive]);

  const handleSearchSubmit = (queryText?: string) => {
    const finalQuery = (queryText ?? searchQuery).trim();
    if (!finalQuery) return;
    setSearchActive(false);
    setSearchQuery('');
    setSuggestions([]);
    navigate({
      name: 'SearchResults',
      params: {filter: finalQuery},
    });
  };

  const displayImage =
    meta?.background ||
    info?.image ||
    info?.poster ||
    currentHero?.image ||
    '';

  const displayTitle = meta?.name || info?.title || currentHero?.title || '';
  const displayGenres: string[] =
    (Array.isArray(meta?.genres) && meta.genres.length > 0
      ? meta.genres
      : info?.tags) || [];

  return (
    <div
      className="relative w-full h-[410px] overflow-hidden select-none"
      style={{backgroundColor: colors.background}}>
      {/* Top Header Controls */}
      <div className="absolute top-5 left-0 right-0 z-30 px-4 flex items-center justify-between gap-3">
        {!searchActive && (
          <div>
            {showHamburgerMenu && (
              <button
                onClick={openDrawer}
                className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-transform active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: 'rgba(28, 27, 31, 0.72)',
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                }}
                title="Select Provider">
                <Menu size={18} />
              </button>
            )}
          </div>
        )}

        {searchActive ? (
          <div className="flex-1 max-w-xl mx-auto relative">
            <div
              className="flex items-center h-11 px-4 rounded-full border shadow-xl"
              style={{
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outline,
              }}>
              <Search
                size={18}
                className="mr-3 shrink-0"
                style={{color: colors.onSurfaceVariant}}
              />
              <input
                ref={searchInputRef}
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSearchSubmit();
                  if (e.key === 'Escape') setSearchActive(false);
                }}
                placeholder="Search across all providers..."
                className="w-full bg-transparent text-sm outline-none"
                style={{color: colors.onSurface}}
              />
              <button
                onClick={() => {
                  setSearchActive(false);
                  setSearchQuery('');
                  setSuggestions([]);
                }}
                className="p-1 rounded-full hover:bg-white/10 cursor-pointer"
                style={{color: colors.onSurfaceVariant}}>
                <X size={16} />
              </button>
            </div>

            {suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 mt-2 rounded-2xl border overflow-hidden shadow-2xl z-40"
                style={{
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                }}>
                {suggestions.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSearchSubmit(item.l)}
                    className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-white/5 border-b last:border-b-0 cursor-pointer"
                    style={{borderColor: colors.outlineVariant}}>
                    {item.i?.imageUrl ? (
                      <img
                        src={item.i.imageUrl}
                        alt={item.l}
                        className="w-8 h-11 rounded object-cover shrink-0 bg-black/40"
                      />
                    ) : (
                      <div className="w-8 h-11 rounded bg-white/10 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-medium truncate"
                        style={{color: colors.onSurface}}>
                        {item.l}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{color: colors.onSurfaceVariant}}>
                        {[item.y, item.q, item.s].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setSearchActive(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-transform active:scale-95 cursor-pointer ml-auto"
            style={{
              backgroundColor: 'rgba(28, 27, 31, 0.72)',
              borderColor: colors.outlineVariant,
              color: colors.onSurface,
            }}
            title="Search">
            <Search size={18} />
          </button>
        )}
      </div>

      {/* Hero Backdrop & Poster */}
      {isLoading && !currentHero ? (
        <div className="w-full h-full flex flex-col items-center justify-end pb-10 px-6 animate-pulse">
          <div
            className="w-52 h-7 rounded-lg mb-3"
            style={{backgroundColor: colors.surfaceContainerHighest}}
          />
          <div
            className="w-36 h-4 rounded-md mb-4"
            style={{backgroundColor: colors.surfaceContainerHigh}}
          />
          <div
            className="w-36 h-10 rounded-full"
            style={{backgroundColor: colors.surfaceContainerHighest}}
          />
        </div>
      ) : currentHero ? (
        <>
          {displayImage && !imageError ? (
            <div className="absolute inset-0">
              {/* Blurred ambient backdrop */}
              <img
                src={displayImage}
                alt=""
                className="w-full h-full object-cover scale-110 blur-xl opacity-55"
                onError={() => setImageError(true)}
              />
              {/* Crisp centered hero image */}
              <div className="absolute inset-0 flex items-center justify-center pb-14 pt-6">
                <img
                  src={displayImage}
                  alt={displayTitle}
                  className="h-full max-h-[290px] w-auto rounded-2xl object-cover shadow-2xl border border-white/10"
                  onError={() => setImageError(true)}
                />
              </div>
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{backgroundColor: colors.surfaceContainerLow}}
            />
          )}

          {/* Bottom Gradient */}
          <div
            className="absolute inset-x-0 bottom-0 h-56 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${colors.background} 12%, rgba(23,23,23,0.75) 55%, transparent 100%)`,
            }}
          />

          {/* Hero Metadata & Watch Now */}
          <div className="absolute inset-x-0 bottom-5 z-20 flex flex-col items-center text-center px-6">
            {meta?.logo ? (
              <img
                src={meta.logo}
                alt={displayTitle}
                className="h-14 max-w-[220px] object-contain mb-2 drop-shadow-lg"
              />
            ) : (
              <h2
                className="text-2xl sm:text-3xl font-extrabold tracking-tight line-clamp-2 max-w-xl mb-1.5 drop-shadow"
                style={{color: colors.onSurface}}>
                {displayTitle}
              </h2>
            )}

            {displayGenres.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
                {displayGenres.slice(0, 3).map((g, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-semibold px-2 py-0.5 rounded-md"
                    style={{
                      color: colors.onSurfaceVariant,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                    }}>
                    {g}
                  </span>
                ))}
              </div>
            )}

            {currentHero.link && !heroDetailLoading && (
              <button
                onClick={() =>
                  navigate({
                    name: 'Info',
                    params: {
                      link: currentHero.link,
                      provider: provider.value,
                      poster: displayImage,
                    },
                  })
                }
                className="px-6 py-2.5 rounded-full flex items-center gap-2.5 text-sm font-bold shadow-lg transition-transform active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                }}>
                <Play size={16} fill="currentColor" />
                <span>Watch now</span>
              </button>
            )}
          </div>
        </>
      ) : null}

      {/* Scrim when search overlay is open */}
      {searchActive && (
        <div
          className="absolute inset-0 z-20"
          style={{backgroundColor: 'rgba(0,0,0,0.65)'}}
          onClick={() => setSearchActive(false)}
        />
      )}
    </div>
  );
};
