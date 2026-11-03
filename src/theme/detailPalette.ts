import {useEffect, useState} from 'react';
import type {M3Palette} from './colors';
import {useM3Colors} from './M3PaletteContext';
import {settingsStorage} from '../lib/storage';

export function useDetailSeedPalette(imageUrl?: string): M3Palette {
  const basePalette = useM3Colors();
  const [dynamicAccent, setDynamicAccent] = useState<{
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
  } | null>(null);

  useEffect(() => {
    if (!imageUrl || !settingsStorage.isDynamicInfoAccentEnabled()) {
      setDynamicAccent(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const proxyUrl = `/api/stream-proxy?url=${encodeURIComponent(imageUrl)}`;
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 24, 24);
        const data = ctx.getImageData(0, 0, 24, 24).data;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          if (a > 180 && luma > 35 && luma < 225) {
            rSum += r;
            gSum += g;
            bSum += b;
            count++;
          }
        }
        if (count > 10) {
          const rAvg = Math.round(rSum / count);
          const gAvg = Math.round(gSum / count);
          const bAvg = Math.round(bSum / count);
          const rLight = Math.min(255, Math.round(rAvg + (255 - rAvg) * 0.45));
          const gLight = Math.min(255, Math.round(gAvg + (255 - gAvg) * 0.45));
          const bLight = Math.min(255, Math.round(bAvg + (255 - bAvg) * 0.45));
          const rDark = Math.max(15, Math.round(rAvg * 0.35));
          const gDark = Math.max(15, Math.round(gAvg * 0.35));
          const bDark = Math.max(15, Math.round(bAvg * 0.35));

          setDynamicAccent({
            primary: `rgb(${rLight}, ${gLight}, ${bLight})`,
            onPrimary: `rgb(${Math.round(rDark * 0.6)}, ${Math.round(gDark * 0.6)}, ${Math.round(bDark * 0.6)})`,
            primaryContainer: `rgb(${rDark}, ${gDark}, ${bDark})`,
            onPrimaryContainer: `rgb(${Math.min(255, rLight + 20)}, ${Math.min(255, gLight + 20)}, ${Math.min(255, bLight + 20)})`,
            secondaryContainer: `rgba(${rLight}, ${gLight}, ${bLight}, 0.22)`,
            onSecondaryContainer: `rgb(${rLight}, ${gLight}, ${bLight})`,
          });
        }
      } catch {
        // Ignore canvas errors
      }
    };
    img.src = proxyUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  if (!dynamicAccent) {
    return basePalette;
  }

  return {
    ...basePalette,
    ...dynamicAccent,
  };
}
