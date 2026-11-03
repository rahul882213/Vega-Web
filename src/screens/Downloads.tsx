import React, {useRef} from 'react';
import {
  Download,
  Play,
  Trash2,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation} from '../NavigationContext';
import useDownloadsStore, {DownloadItem} from '../lib/zustand/downloadsStore';

export const Downloads: React.FC = () => {
  const colors = useM3Colors();
  const {navigate} = useVegaNavigation();
  const {downloads, removeDownload} = useDownloadsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const items: DownloadItem[] = Object.values(downloads).sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  const handlePlayDownload = (item: DownloadItem) => {
    navigate({
      name: 'Player',
      params: {
        linkList: [
          {
            title: item.episodeName || item.title,
            link: item.sourceLink || item.url,
          },
        ],
        episodeIndex: 0,
        type: item.type,
        primaryTitle: item.showName || item.title,
        secondaryTitle: item.episodeName,
        poster: {
          poster: item.poster,
          background: item.background,
        },
        file: item.sourceType === 'http' ? item.url : undefined,
        providerValue: item.provider,
        infoUrl: item.infoUrl,
      },
    });
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{color: colors.onSurface}}>
              Downloads
            </h1>
            <p
              className="text-xs mt-0.5"
              style={{color: colors.onSurfaceVariant}}>
              Saved media streams and local device files
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold cursor-pointer"
            style={{
              backgroundColor: colors.primary,
              color: colors.onPrimary,
            }}>
            <FolderOpen size={15} />
            <span>Open Local Video</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mkv,.mp4,.webm"
            className="hidden"
            onChange={handleOpenLocalFile}
          />
        </div>

        {items.length === 0 ? (
          <div className="py-20 text-center">
            <Download
              size={44}
              className="mx-auto mb-3 opacity-30"
              style={{color: colors.onSurfaceVariant}}
            />
            <p
              className="text-base font-bold mb-1"
              style={{color: colors.onSurface}}>
              No downloads yet
            </p>
            <p
              className="text-xs max-w-xs mx-auto"
              style={{color: colors.onSurfaceVariant}}>
              Download movies or episodes from any title detail page, or open a
              local video file above.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map(item => {
              const encodedHeaders = item.headers
                ? window.btoa(JSON.stringify(item.headers))
                : '';
              const directDownloadUrl = `/api/stream-proxy?url=${encodeURIComponent(
                item.url,
              )}${
                encodedHeaders
                  ? `&headers=${encodeURIComponent(encodedHeaders)}`
                  : ''
              }`;

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border flex items-center justify-between gap-3"
                  style={{
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  }}>
                  <div
                    onClick={() => handlePlayDownload(item)}
                    className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer">
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="w-12 h-16 rounded-xl object-cover shrink-0 bg-black/30"
                      />
                    ) : (
                      <div
                        className="w-12 h-16 rounded-xl flex items-center justify-center shrink-0"
                        style={{backgroundColor: colors.surfaceContainerHigh}}>
                        <Play size={18} style={{color: colors.primary}} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-bold truncate"
                        style={{color: colors.onSurface}}>
                        {item.title}
                      </p>
                      <p
                        className="text-xs mt-0.5 truncate"
                        style={{color: colors.onSurfaceVariant}}>
                        {[
                          item.provider,
                          item.server,
                          item.quality ? `${item.quality}p` : null,
                          item.status.toUpperCase(),
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handlePlayDownload(item)}
                      className="p-2.5 rounded-full cursor-pointer"
                      style={{
                        backgroundColor: colors.primary,
                        color: colors.onPrimary,
                      }}
                      title="Play">
                      <Play size={15} fill="currentColor" />
                    </button>

                    <a
                      href={directDownloadUrl}
                      download={`${item.title}.mp4`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-full border hover:bg-white/10"
                      style={{
                        borderColor: colors.outlineVariant,
                        color: colors.onSurfaceVariant,
                      }}
                      title="Save file to browser downloads">
                      <ExternalLink size={15} />
                    </a>

                    <button
                      onClick={() => removeDownload(item.id)}
                      className="p-2.5 rounded-full cursor-pointer"
                      style={{
                        backgroundColor: colors.errorContainer,
                        color: colors.onErrorContainer,
                      }}
                      title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
