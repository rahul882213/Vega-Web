import React, {useState, useEffect} from 'react';
import {Search as SearchIcon, Clock, Trash2, X, ArrowUpLeft} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation} from '../NavigationContext';
import {mainStorage} from '../lib/storage';
import {fetchImdbSuggestions, ImdbSuggestionItem} from '../lib/services/imdb';

const SEARCH_HISTORY_KEY = 'searchHistory';
const MAX_HISTORY_ITEMS = 25;

export const Search: React.FC = () => {
  const colors = useM3Colors();
  const {navigate} = useVegaNavigation();

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<ImdbSuggestionItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>(
    () => mainStorage.getArray<string>(SEARCH_HISTORY_KEY) || [],
  );

  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchImdbSuggestions(trimmed, controller.signal).then(res => {
        if (!controller.signal.aborted) {
          setSuggestions(res.slice(0, 10));
        }
      });
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchText]);

  const saveHistory = (term: string) => {
    const normalized = term.trim();
    if (!normalized) return;
    const next = [
      normalized,
      ...searchHistory.filter(
        h => h.toLowerCase() !== normalized.toLowerCase(),
      ),
    ].slice(0, MAX_HISTORY_ITEMS);
    setSearchHistory(next);
    mainStorage.setArray(SEARCH_HISTORY_KEY, next);
  };

  const handleSearch = (query?: string) => {
    const finalQuery = (query ?? searchText).trim();
    if (!finalQuery) return;
    saveHistory(finalQuery);
    navigate({
      name: 'SearchResults',
      params: {filter: finalQuery},
    });
  };

  const removeHistoryItem = (term: string) => {
    const next = searchHistory.filter(h => h !== term);
    setSearchHistory(next);
    mainStorage.setArray(SEARCH_HISTORY_KEY, next);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    mainStorage.setArray(SEARCH_HISTORY_KEY, []);
  };

  return (
    <div
      className="flex-1 min-h-screen px-4 pt-6 pb-24 sm:pb-12 overflow-y-auto select-none"
      style={{backgroundColor: colors.background}}>
      <div className="max-w-3xl mx-auto">
        <h1
          className="text-2xl font-bold tracking-tight mb-4"
          style={{color: colors.onSurface}}>
          Search
        </h1>

        {/* Search Input Bar */}
        <div
          className="flex items-center h-13 px-4 rounded-2xl border mb-6"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          }}>
          <SearchIcon
            size={20}
            className="mr-3 shrink-0"
            style={{color: colors.onSurfaceVariant}}
          />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder="Search across all installed providers..."
            className="w-full bg-transparent text-sm outline-none"
            style={{color: colors.onSurface}}
          />
          {searchText && (
            <button
              onClick={() => {
                setSearchText('');
                setSuggestions([]);
              }}
              className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
              style={{color: colors.onSurfaceVariant}}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Live IMDb Suggestions */}
        {suggestions.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1 mb-2">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{color: colors.onSurfaceVariant}}>
                Suggestions
              </span>
              <button
                onClick={() => handleSearch()}
                className="text-xs font-semibold cursor-pointer"
                style={{color: colors.primary}}>
                Search "{searchText.trim()}" across providers →
              </button>
            </div>

            {suggestions.map(item => (
              <div
                key={item.id}
                onClick={() => handleSearch(item.l)}
                className="flex items-center justify-between p-2.5 rounded-2xl border hover:bg-white/[0.04] transition-colors cursor-pointer"
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                }}>
                <div className="flex items-center gap-3 min-w-0">
                  {item.i?.imageUrl ? (
                    <img
                      src={item.i.imageUrl}
                      alt={item.l}
                      className="w-10 h-14 rounded-lg object-cover shrink-0 bg-black/30"
                    />
                  ) : (
                    <div
                      className="w-10 h-14 rounded-lg shrink-0"
                      style={{backgroundColor: colors.surfaceContainerHigh}}
                    />
                  )}
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{color: colors.onSurface}}>
                      {item.l}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{color: colors.onSurfaceVariant}}>
                      {[item.y, item.q, item.s].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setSearchText(item.l);
                  }}
                  className="p-2 rounded-full hover:bg-white/10 cursor-pointer"
                  style={{color: colors.onSurfaceVariant}}>
                  <ArrowUpLeft size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* Recent Search History */
          <div>
            {searchHistory.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{color: colors.onSurfaceVariant}}>
                    Recent Searches
                  </span>
                  <button
                    onClick={clearHistory}
                    className="text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    style={{color: colors.error}}>
                    <Trash2 size={13} />
                    <span>Clear all</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {searchHistory.map(term => (
                    <div
                      key={term}
                      onClick={() => handleSearch(term)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl border hover:bg-white/[0.03] transition-colors cursor-pointer"
                      style={{
                        backgroundColor: colors.surfaceContainerLow,
                        borderColor: colors.outlineVariant,
                      }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Clock
                          size={15}
                          style={{color: colors.onSurfaceVariant}}
                        />
                        <span
                          className="text-sm truncate"
                          style={{color: colors.onSurface}}>
                          {term}
                        </span>
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          removeHistoryItem(term);
                        }}
                        className="p-1 rounded-full hover:bg-white/10 cursor-pointer"
                        style={{color: colors.onSurfaceVariant}}>
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-20 text-center">
                <SearchIcon
                  size={40}
                  className="mx-auto mb-3 opacity-30"
                  style={{color: colors.onSurfaceVariant}}
                />
                <p
                  className="text-sm font-medium"
                  style={{color: colors.onSurfaceVariant}}>
                  Type a movie or TV series title to search across all installed
                  providers
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
