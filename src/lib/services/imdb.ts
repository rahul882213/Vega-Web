import {proxyFetch} from '../sandbox/sandboxRuntime';
import {Post} from '../providers/types';

export interface ImdbSuggestionItem {
  id: string;
  l: string;
  y?: number;
  q?: string;
  qid?: string;
  s?: string;
  i?: {
    imageUrl: string;
    width?: number;
    height?: number;
  };
}

export async function fetchImdbSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<ImdbSuggestionItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const firstChar = trimmed[0].toLowerCase().replace(/[^a-z0-9]/, '_');
  const encoded = encodeURIComponent(trimmed.toLowerCase());
  const url = `https://v2.sg.media-imdb.com/suggestion/${firstChar}/${encoded}.json`;
  try {
    const res = await proxyFetch('imdb', url, {method: 'GET', signal});
    if (res.status >= 200 && res.status < 300 && res.bodyText) {
      const parsed = JSON.parse(res.bodyText);
      if (Array.isArray(parsed?.d)) {
        return parsed.d.filter(
          (item: any) =>
            item &&
            typeof item.l === 'string' &&
            item.id &&
            String(item.id).startsWith('tt'),
        );
      }
    }
  } catch {
    // Ignore suggestion errors
  }
  return [];
}

export function imdbSuggestionsToPosts(items: ImdbSuggestionItem[]): Post[] {
  return items.map(item => ({
    title: item.y ? `${item.l} (${item.y})` : item.l,
    link: item.id,
    image: item.i?.imageUrl || '',
    provider: 'imdb',
  }));
}
