import {mainStorage} from './StorageService';

export enum WatchListKeys {
  WATCH_LIST = 'watchlist',
  COLLECTIONS = 'library-collections',
  DEFAULT_COLLECTION_ADDED = 'library-default-collection-added',
}

export const DEFAULT_COLLECTION_ID = 'watchlist';

export interface WatchListItem {
  title: string;
  poster: string;
  link: string;
  provider: string;
  updatedAt?: number;
  collections?: string[];
}

export interface LibraryCollection {
  id: string;
  name: string;
  icon: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_COLLECTION: LibraryCollection = {
  id: DEFAULT_COLLECTION_ID,
  name: 'Watchlist',
  icon: 'bookmark',
  createdAt: 0,
  updatedAt: 0,
};

export const getItemCollectionIds = (
  item: WatchListItem,
  existingIds: ReadonlySet<string>,
): string[] => {
  const ids = (item.collections || []).filter(id => existingIds.has(id));
  if (ids.length > 0) {
    return ids;
  }
  return existingIds.has(DEFAULT_COLLECTION_ID) ? [DEFAULT_COLLECTION_ID] : [];
};

export const createCollectionId = (): string =>
  `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export class WatchListStorage {
  getWatchList(): WatchListItem[] {
    const watchList =
      mainStorage.getArray<Partial<WatchListItem>>(WatchListKeys.WATCH_LIST) ||
      [];
    return watchList
      .filter(item => Boolean(item.title && item.link && item.provider))
      .map(item => ({...item, poster: item.poster || ''}) as WatchListItem);
  }

  addToWatchList(item: WatchListItem): WatchListItem[] {
    if (!item.provider) {
      return this.getWatchList();
    }
    const watchList = this.getWatchList();
    const newWatchList = watchList.filter(i => i.link !== item.link);
    const collections = this.getCollections();
    const fallback = collections.some(c => c.id === DEFAULT_COLLECTION_ID)
      ? [DEFAULT_COLLECTION_ID]
      : collections.length === 1
        ? [collections[0].id]
        : [];
    newWatchList.push({
      ...item,
      collections: item.collections?.length ? item.collections : fallback,
      updatedAt: Date.now(),
    });
    mainStorage.setArray(WatchListKeys.WATCH_LIST, newWatchList);
    return newWatchList;
  }

  setItemCollections(item: WatchListItem, ids: string[]): WatchListItem[] {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return this.removeFromWatchList(item.link);
    }
    const watchList = this.getWatchList();
    const index = watchList.findIndex(i => i.link === item.link);
    if (index === -1) {
      return this.addToWatchList({...item, collections: unique});
    }
    watchList[index] = {
      ...watchList[index],
      collections: unique,
      updatedAt: Date.now(),
    };
    mainStorage.setArray(WatchListKeys.WATCH_LIST, watchList);
    return watchList;
  }

  removeFromWatchList(link: string): WatchListItem[] {
    const watchList = this.getWatchList();
    const newWatchList = watchList.filter(item => item.link !== link);
    mainStorage.setArray(WatchListKeys.WATCH_LIST, newWatchList);
    return newWatchList;
  }

  clearWatchList(): WatchListItem[] {
    const emptyList: WatchListItem[] = [];
    mainStorage.setArray(WatchListKeys.WATCH_LIST, emptyList);
    return emptyList;
  }

  isInWatchList(link: string): boolean {
    const watchList = this.getWatchList();
    return watchList.some(item => item.link === link);
  }

  getCollections(): LibraryCollection[] {
    const collections = (
      mainStorage.getArray<LibraryCollection>(WatchListKeys.COLLECTIONS) || []
    ).filter(c => Boolean(c?.id && c.name));
    if (!mainStorage.getBool(WatchListKeys.DEFAULT_COLLECTION_ADDED, false)) {
      mainStorage.setBool(WatchListKeys.DEFAULT_COLLECTION_ADDED, true);
      if (!collections.some(c => c.id === DEFAULT_COLLECTION_ID)) {
        return this.saveCollections([DEFAULT_COLLECTION, ...collections]);
      }
    }
    return collections.sort((a, b) => a.createdAt - b.createdAt);
  }

  saveCollections(collections: LibraryCollection[]): LibraryCollection[] {
    const sorted = [...collections].sort((a, b) => a.createdAt - b.createdAt);
    mainStorage.setArray(WatchListKeys.COLLECTIONS, sorted);
    return sorted;
  }

  deleteCollection(id: string): {
    collections: LibraryCollection[];
    watchList: WatchListItem[];
  } {
    const collections = this.saveCollections(
      this.getCollections().filter(c => c.id !== id),
    );
    const fallback = collections.some(c => c.id === DEFAULT_COLLECTION_ID)
      ? [DEFAULT_COLLECTION_ID]
      : [];
    const now = Date.now();
    let changed = false;
    const watchList = this.getWatchList().map(item => {
      if (!item.collections?.includes(id)) {
        return item;
      }
      changed = true;
      const rest = item.collections.filter(c => c !== id);
      return {
        ...item,
        collections: rest.length > 0 ? rest : fallback,
        updatedAt: now,
      };
    });
    if (changed) {
      mainStorage.setArray(WatchListKeys.WATCH_LIST, watchList);
    }
    return {collections, watchList};
  }
}

export const watchListStorage = new WatchListStorage();
