import { useCallback, useRef } from 'react';
import { commands } from '../lib/commands';

/**
 * In-memory image cache for graph nodes.
 * Batch-loads asset images and stores them as data URLs.
 */
export function useImageCache() {
  const cache = useRef<Map<string, string>>(new Map());
  const pending = useRef<Set<string>>(new Set());

  /** Get a cached data URL for an asset, or null if not yet loaded */
  const getImageUrl = useCallback((assetId: string | null): string | null => {
    if (!assetId) return null;
    return cache.current.get(assetId) ?? null;
  }, []);

  /** Batch-load images for the given asset IDs. Skips already cached/pending. */
  const loadImages = useCallback(async (assetIds: (string | null)[]) => {
    const needed = assetIds.filter(
      (id): id is string =>
        id != null && !cache.current.has(id) && !pending.current.has(id),
    );

    if (needed.length === 0) return;

    // Mark as pending to avoid duplicate requests
    for (const id of needed) {
      pending.current.add(id);
    }

    try {
      const items = await commands.getAssetBatch(needed);
      for (const item of items) {
        const dataUrl = `data:${item.mime_type};base64,${item.data_base64}`;
        cache.current.set(item.id, dataUrl);
        pending.current.delete(item.id);
      }
    } catch (e) {
      console.error('Failed to load image batch:', e);
      // Clear pending so they can be retried
      for (const id of needed) {
        pending.current.delete(id);
      }
    }
  }, []);

  /** Check how many images are cached */
  const cacheSize = useCallback(() => cache.current.size, []);

  return { getImageUrl, loadImages, cacheSize };
}
