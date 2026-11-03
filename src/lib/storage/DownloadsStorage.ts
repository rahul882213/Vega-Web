import {mainStorage} from './StorageService';

export enum DownloadsKeys {
  DOWNLOADS = 'downloads',
}

export interface DownloadPayload {
  fileName: string;
  url?: string;
  fileType?: string;
  folderName?: string;
  provider?: string;
  status: 'downloading' | 'downloaded' | 'error';
  progress?: number;
}

export class DownloadsStorage {
  takeLegacyDownloads(): Map<string, DownloadPayload> {
    return new Map();
  }

  clearAll(): void {
    mainStorage.delete(DownloadsKeys.DOWNLOADS);
  }
}

export const downloadsStorage = new DownloadsStorage();
