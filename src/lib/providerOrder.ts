import type {ProviderExtension} from './storage/extensionStorage';

export const providerOrderKey = (provider: ProviderExtension): string => {
  const author = provider.source?.author?.trim().toLowerCase() || '';
  return author ? `${author}:${provider.value}` : provider.value;
};

export const sortInstalledProviders = (
  providers: ProviderExtension[],
  order: string[],
): ProviderExtension[] => {
  if (!order || order.length === 0) {
    return [...providers];
  }
  const indexMap = new Map<string, number>();
  order.forEach((key, idx) => {
    indexMap.set(key.toLowerCase(), idx);
  });

  return [...providers].sort((a, b) => {
    const keyA = providerOrderKey(a).toLowerCase();
    const keyB = providerOrderKey(b).toLowerCase();
    const idxA = indexMap.get(keyA) ?? indexMap.get(a.value.toLowerCase());
    const idxB = indexMap.get(keyB) ?? indexMap.get(b.value.toLowerCase());
    if (idxA !== undefined && idxB !== undefined) {
      return idxA - idxB;
    }
    if (idxA !== undefined) return -1;
    if (idxB !== undefined) return 1;
    return 0;
  });
};
