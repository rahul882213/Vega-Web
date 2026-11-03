import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import type {EpisodeLink} from '../providers/types';
import {createZustandStorage} from '../storage/StorageService';

export interface ContinueWatchingItem {
  id: string;
  title: string;
  episodeTitle?: string;
  seasonTitle?: string;
  episode: EpisodeLink;
  type: string;
  poster?: string;
  background?: string;
  providerValue: string;
  infoUrl: string;
  position: number;
  duration: number;
  updatedAt: number;
}

interface ContinueWatchingState {
  items: ContinueWatchingItem[];
  upsertItem: (item: ContinueWatchingItem) => void;
  updateProgress: (
    id: string,
    position: number,
    duration: number,
    episode?: EpisodeLink,
  ) => void;
  finishEpisode: (
    id: string,
    episode: EpisodeLink,
    next?: EpisodeLink,
    nextProgress?: {position: number; duration: number},
  ) => boolean;
  removeItem: (id: string) => void;
}

const getEpisodeIdentity = (ep?: EpisodeLink) =>
  `${ep?.link || ''}::${ep?.title || ''}`;

const useContinueWatchingStore = create<ContinueWatchingState>()(
  persist(
    (set, get) => ({
      items: [],
      upsertItem: item =>
        set(state => ({
          items: [
            item,
            ...state.items
              .filter(existing => existing.id !== item.id)
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, 29),
          ].sort((a, b) => b.updatedAt - a.updatedAt),
        })),
      updateProgress: (id, position, duration, episode) =>
        set(state => ({
          items: state.items
            .map(item =>
              item.id === id &&
              (!episode ||
                getEpisodeIdentity(item.episode) ===
                  getEpisodeIdentity(episode))
                ? {...item, position, duration, updatedAt: Date.now()}
                : item,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt),
        })),
      finishEpisode: (id, episode, next, nextProgress) => {
        const item = get().items.find(existing => existing.id === id);
        if (!item || !next || item.type === 'movie') {
          return false;
        }
        if (getEpisodeIdentity(item.episode) !== getEpisodeIdentity(episode)) {
          return false;
        }
        const upNext: ContinueWatchingItem = {
          ...item,
          episode: next,
          episodeTitle: next.title,
          position: nextProgress?.position || 0,
          duration: nextProgress?.duration || 0,
          updatedAt: Date.now(),
        };
        set(state => ({
          items: state.items
            .map(existing => (existing.id === id ? upNext : existing))
            .sort((a, b) => b.updatedAt - a.updatedAt),
        }));
        return true;
      },
      removeItem: id =>
        set(state => ({items: state.items.filter(item => item.id !== id)})),
    }),
    {
      name: 'continue-watching-storage',
      storage: createJSONStorage(() => createZustandStorage()),
    },
  ),
);

export default useContinueWatchingStore;
