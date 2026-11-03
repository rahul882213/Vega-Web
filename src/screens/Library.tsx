import React, {useState, useMemo, useRef} from 'react';
import {
  Bookmark,
  Plus,
  Trash2,
  FolderOpen,
  Check,
  X,
  Edit3,
} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation} from '../NavigationContext';
import useWatchListStore from '../lib/zustand/watchListStore';
import {getItemCollectionIds, LibraryCollection} from '../lib/storage';

const ALL_FILTER = '__all__';

export const Library: React.FC = () => {
  const colors = useM3Colors();
  const {navigate} = useVegaNavigation();
  const {
    watchList,
    collections,
    removeItem,
    createCollection,
    updateCollection,
    deleteCollection,
  } = useWatchListStore();

  const [selectedCollectionId, setSelectedCollectionId] =
    useState<string>(ALL_FILTER);
  const [selectedLinks, setSelectedLinks] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] =
    useState<LibraryCollection | null>(null);
  const [categoryName, setCategoryName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingCollectionIds = useMemo(
    () => new Set(collections.map(c => c.id)),
    [collections],
  );

  const visibleItems = useMemo(() => {
    const items = [...watchList].reverse();
    if (selectedCollectionId === ALL_FILTER) return items;
    return items.filter(item =>
      getItemCollectionIds(item, existingCollectionIds).includes(
        selectedCollectionId,
      ),
    );
  }, [watchList, selectedCollectionId, existingCollectionIds]);

  const isSelectionMode = selectedLinks.length > 0;

  const toggleSelect = (link: string) => {
    setSelectedLinks(prev =>
      prev.includes(link) ? prev.filter(l => l !== link) : [...prev, link],
    );
  };

  const handleDeleteSelected = () => {
    selectedLinks.forEach(link => removeItem(link));
    setSelectedLinks([]);
  };

  const handleSaveCategory = () => {
    if (!categoryName.trim()) return;
    if (editingCollection) {
      updateCollection(editingCollection.id, {
        name: categoryName.trim(),
        icon: editingCollection.icon || 'bookmark',
      });
    } else {
      const created = createCollection({
        name: categoryName.trim(),
        icon: 'bookmark',
      });
      setSelectedCollectionId(created.id);
    }
    setCategoryName('');
    setEditingCollection(null);
    setDialogOpen(false);
  };

  const handleOpenLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    navigate({
      name: 'Player',
      params: {
        linkList: [{title: file.name, link: url}],
        episodeIndex: 0,
        type: 'movie',
        primaryTitle: file.name.replace(/\.[^/.]+$/, ''),
        poster: {},
        file: url,
        providerValue: 'local',
      },
    });
  };

  return (
    <div
      className="flex-1 min-h-screen px-4 pt-6 pb-24 sm:pb-12 overflow-y-auto select-none"
      style={{backgroundColor: colors.background}}>
      <div className="max-w-5xl mx-auto">
        {/* Header / Selection Toolbar */}
        {isSelectionMode ? (
          <div
            className="flex items-center justify-between p-3 rounded-2xl border mb-4"
            style={{
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
            }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedLinks([])}
                className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
                style={{color: colors.onSurface}}>
                <X size={18} />
              </button>
              <span
                className="text-sm font-bold"
                style={{color: colors.onSurface}}>
                {selectedLinks.length} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setSelectedLinks(visibleItems.map(item => item.link))
                }
                className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: colors.secondaryContainer,
                  color: colors.onSecondaryContainer,
                }}>
                Select All
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: colors.errorContainer,
                  color: colors.onErrorContainer,
                }}>
                <Trash2 size={14} />
                <span>Remove</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-4">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{color: colors.onSurface}}>
              Library
            </h1>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-full border flex items-center gap-2 text-xs font-semibold hover:bg-white/5 cursor-pointer"
              style={{
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
                color: colors.onSurface,
              }}>
              <FolderOpen size={15} style={{color: colors.primary}} />
              <span>Local File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mkv,.mp4,.webm"
              className="hidden"
              onChange={handleOpenLocalFile}
            />
          </div>
        )}

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
          <button
            onClick={() => setSelectedCollectionId(ALL_FILTER)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border shrink-0 cursor-pointer"
            style={{
              backgroundColor:
                selectedCollectionId === ALL_FILTER
                  ? colors.secondaryContainer
                  : colors.surfaceContainerLow,
              borderColor:
                selectedCollectionId === ALL_FILTER
                  ? colors.secondaryContainer
                  : colors.outlineVariant,
              color:
                selectedCollectionId === ALL_FILTER
                  ? colors.onSecondaryContainer
                  : colors.onSurfaceVariant,
            }}>
            All ({watchList.length})
          </button>

          {collections.map(col => {
            const active = selectedCollectionId === col.id;
            const count = watchList.filter(item =>
              getItemCollectionIds(item, existingCollectionIds).includes(col.id),
            ).length;
            return (
              <div
                key={col.id}
                className="flex items-center gap-1 pl-3.5 pr-2 py-1 rounded-xl border shrink-0"
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
                <button
                  onClick={() => setSelectedCollectionId(col.id)}
                  className="text-xs font-semibold cursor-pointer">
                  {col.name} ({count})
                </button>
                <button
                  onClick={() => {
                    setEditingCollection(col);
                    setCategoryName(col.name);
                    setDialogOpen(true);
                  }}
                  className="p-1 rounded-full hover:bg-black/20 cursor-pointer"
                  title="Edit category">
                  <Edit3 size={11} />
                </button>
              </div>
            );
          })}

          <button
            onClick={() => {
              setEditingCollection(null);
              setCategoryName('');
              setDialogOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-dashed flex items-center gap-1 shrink-0 cursor-pointer"
            style={{
              borderColor: colors.outline,
              color: colors.onSurfaceVariant,
            }}>
            <Plus size={14} />
            <span>New</span>
          </button>
        </div>

        {/* Grid of Saved Items */}
        {visibleItems.length === 0 ? (
          <div className="py-20 text-center">
            <Bookmark
              size={44}
              className="mx-auto mb-3 opacity-30"
              style={{color: colors.onSurfaceVariant}}
            />
            <p
              className="text-base font-bold mb-1"
              style={{color: colors.onSurface}}>
              No titles in this category
            </p>
            <p
              className="text-xs max-w-xs mx-auto"
              style={{color: colors.onSurfaceVariant}}>
              Save movies and TV shows from their detail page to access them
              quickly here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5">
            {visibleItems.map(item => {
              const selected = selectedLinks.includes(item.link);
              return (
                <div
                  key={item.link}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleSelect(item.link);
                    } else {
                      navigate({
                        name: 'Info',
                        params: {
                          link: item.link,
                          provider: item.provider,
                          poster: item.poster,
                        },
                      });
                    }
                  }}
                  onContextMenu={e => {
                    e.preventDefault();
                    toggleSelect(item.link);
                  }}
                  className="text-left group cursor-pointer relative">
                  <div
                    className="aspect-[2/3] w-full rounded-xl overflow-hidden border relative transition-transform group-hover:scale-[1.02]"
                    style={{
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: selected
                        ? colors.primary
                        : 'rgba(255,255,255,0.06)',
                    }}>
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2 text-xs text-center opacity-50">
                        {item.title}
                      </div>
                    )}

                    {selected && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: colors.primary,
                            color: colors.onPrimary,
                          }}>
                          <Check size={16} />
                        </div>
                      </div>
                    )}
                  </div>
                  <p
                    className="text-xs font-medium mt-1.5 line-clamp-2"
                    style={{color: colors.onSurface}}>
                    {item.title}
                  </p>
                  <p
                    className="text-[10px] truncate"
                    style={{color: colors.onSurfaceVariant}}>
                    {item.provider}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Category Modal */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          onClick={() => setDialogOpen(false)}>
          <div
            className="w-full max-w-sm rounded-3xl p-6 border shadow-2xl"
            style={{
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
            }}
            onClick={e => e.stopPropagation()}>
            <h3
              className="text-lg font-bold mb-3"
              style={{color: colors.onSurface}}>
              {editingCollection ? 'Edit Category' : 'New Category'}
            </h3>
            <input
              type="text"
              value={categoryName}
              onChange={e => setCategoryName(e.target.value)}
              placeholder="Category name (e.g. Favorites, Sci-Fi)"
              className="w-full h-11 px-4 rounded-xl border text-sm outline-none mb-4"
              style={{
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
                color: colors.onSurface,
              }}
            />
            <div className="flex items-center justify-between">
              {editingCollection ? (
                <button
                  onClick={() => {
                    deleteCollection(editingCollection.id);
                    if (selectedCollectionId === editingCollection.id) {
                      setSelectedCollectionId(ALL_FILTER);
                    }
                    setDialogOpen(false);
                  }}
                  className="px-4 py-2 rounded-full text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: colors.errorContainer,
                    color: colors.onErrorContainer,
                  }}>
                  Delete
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                  style={{color: colors.onSurfaceVariant}}>
                  Cancel
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="px-5 py-2 rounded-full text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: colors.primary,
                    color: colors.onPrimary,
                  }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
