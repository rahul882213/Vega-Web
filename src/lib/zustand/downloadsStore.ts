import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {createZustandStorage} from '../storage/StorageService';
import type {SkipInterval} from '../providers/types';

export type DownloadStatus =
  | 'queued'
  | 'starting'
  | 'downloading'
  | 'pausing'
  | 'paused'
  | 'finalizing'
  | 'completed'
  | 'interrupted'
  | 'error'
  | 'missing'
  | 'canceling';

export type DownloadSourceType = 'http' | 'hls' | 'torrent';

export interface DownloadSubtitle {
  url: string;
  language: string;
  format?: string;
}

export interface DownloadItem {
  id: string;
  title: string;
  showName?: string;
  episodeName?: string;
  seasonTitle?: string;
  episodeIndex?: number;
  type: 'movie' | 'series';
  imdbId?: string;
  url: string;
  poster?: string;
  background?: string;
  synopsis?: string;
  provider?: string;
  infoUrl?: string;
  sourceLink?: string;
  headers?: Record<string, string>;
  subtitles?: DownloadSubtitle[];
  server?: string;
  quality?: string;
  sourceType: DownloadSourceType;
  totalBytes: number;
  downloadedBytes: number;
  speed: number;
  status: DownloadStatus;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  skip?: SkipInterval[];
}

export type DownloadInput = Pick<
  DownloadItem,
  'id' | 'title' | 'type' | 'url'
> &
  Partial<Omit<DownloadItem, 'id' | 'title' | 'type' | 'url'>>;

interface DownloadState {
  downloads: Record<string, DownloadItem>;
  enqueueDownload: (item: DownloadInput) => void;
  updateProgress: (
    id: string,
    downloaded: number,
    total: number,
    speed: number,
  ) => void;
  markCompleted: (id: string, totalBytes?: number) => void;
  markError: (id: string, message?: string) => void;
  removeDownload: (id: string) => void;
}

export const useDownloadsStore = create<DownloadState>()(
  persist(
    set => ({
      downloads: {},
      enqueueDownload: input => {
        const now = Date.now();
        const sourceType: DownloadSourceType = input.url.includes('.m3u8')
          ? 'hls'
          : 'http';
        const item: DownloadItem = {
          ...input,
          sourceType,
          totalBytes: input.totalBytes || 0,
          downloadedBytes: input.downloadedBytes || 0,
          speed: input.speed || 0,
          status: input.status || 'downloading',
          createdAt: input.createdAt || now,
          updatedAt: now,
        };
        set(state => ({
          downloads: {
            ...state.downloads,
            [item.id]: item,
          },
        }));
      },
      updateProgress: (id, downloaded, total, speed) =>
        set(state => {
          const existing = state.downloads[id];
          if (!existing) return state;
          return {
            downloads: {
              ...state.downloads,
              [id]: {
                ...existing,
                downloadedBytes: downloaded,
                totalBytes: total,
                speed,
                status: 'downloading',
                updatedAt: Date.now(),
              },
            },
          };
        }),
      markCompleted: (id, totalBytes) =>
        set(state => {
          const existing = state.downloads[id];
          if (!existing) return state;
          return {
            downloads: {
              ...state.downloads,
              [id]: {
                ...existing,
                totalBytes: totalBytes ?? existing.totalBytes,
                downloadedBytes: totalBytes ?? existing.downloadedBytes,
                speed: 0,
                status: 'completed',
                completedAt: Date.now(),
                updatedAt: Date.now(),
              },
            },
          };
        }),
      markError: (id, message) =>
        set(state => {
          const existing = state.downloads[id];
          if (!existing) return state;
          return {
            downloads: {
              ...state.downloads,
              [id]: {
                ...existing,
                speed: 0,
                status: 'error',
                errorMessage: message || 'Download failed',
                updatedAt: Date.now(),
              },
            },
          };
        }),
      removeDownload: id =>
        set(state => {
          const next = {...state.downloads};
          delete next[id];
          return {downloads: next};
        }),
    }),
    {
      name: 'vega-downloads-storage',
      storage: createJSONStorage(() => createZustandStorage()),
    },
  ),
);

export default useDownloadsStore;
