import React, {useRef} from 'react';
import {Package, CloudDownload, FolderOpen} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation} from '../NavigationContext';

export const Tutorial: React.FC = () => {
  const colors = useM3Colors();
  const {navigate} = useVegaNavigation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    navigate({
      name: 'Player',
      params: {
        linkList: [{title: file.name, link: objectUrl}],
        episodeIndex: 0,
        type: 'movie',
        primaryTitle: file.name.replace(/\.[^/.]+$/, ''),
        poster: {},
        file: objectUrl,
        providerValue: 'local',
      },
    });
  };

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-12"
      style={{backgroundColor: colors.background}}>
      <div className="w-full max-w-[380px] flex flex-col items-center text-center">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-5"
          style={{backgroundColor: colors.primaryContainer}}>
          <Package size={44} style={{color: colors.onPrimaryContainer}} />
        </div>

        <h1
          className="text-2xl font-bold mb-2.5 tracking-tight"
          style={{color: colors.onSurface}}>
          No Provider Installed
        </h1>

        <p
          className="text-sm leading-relaxed mb-7"
          style={{color: colors.onSurfaceVariant}}>
          Install a cloud provider to browse titles, or open a video stored on
          this device.
        </p>

        <button
          onClick={() => navigate({name: 'Extensions'})}
          className="w-full h-[52px] rounded-full flex items-center justify-center gap-2.5 font-semibold text-base transition-opacity hover:opacity-90 cursor-pointer mb-3"
          style={{
            backgroundColor: colors.primary,
            color: colors.onPrimary,
          }}>
          <CloudDownload size={20} />
          <span>Install Cloud Providers</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-[52px] rounded-full flex items-center justify-center gap-2.5 font-semibold text-base border transition-colors hover:bg-white/5 cursor-pointer"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outline,
            color: colors.onSurface,
          }}>
          <FolderOpen size={20} style={{color: colors.primary}} />
          <span>Play local file</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mkv,.mp4,.webm,.m3u8"
          className="hidden"
          onChange={handleLocalFileChange}
        />
      </div>
    </div>
  );
};
