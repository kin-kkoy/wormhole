import { useCallback, useEffect, useState } from 'react';
import { commands } from '../lib/commands';

/**
 * Shared image cache for asset BLOBs.
 *
 * The cache lives at **module scope** so it's shared across every component
 * that calls `useImageCache()` — a character image loaded by CardImage stays
 * cached when you navigate to CharacterCinematic, etc. Previously each hook
 * instance had its own Map, so switching views triggered re-fetches.
 *
 * We fetch via the binary `get_asset_bytes` command and wrap the bytes in a
 * Blob → `URL.createObjectURL(blob)` rather than a `data:image/...;base64,...`
 * URL. That skips ~33% base64 bloat, avoids multi-MB JSON string parsing on
 * the IPC boundary (the real bottleneck for image display on WebKitGTK), and
 * lets the browser render the image directly from its in-memory Blob.
 *
 * Subscribers are notified when new URLs land in the cache, so components
 * re-render and pick up the fresh URL.
 */

const cache = new Map<string, string>();
const pending = new Set<string>();
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

function sniffImageMime(bytes: Uint8Array): string {
  // PNG
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) return 'image/png';
  // JPEG
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  ) return 'image/jpeg';
  // GIF87a / GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) return 'image/gif';
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  // BMP
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
  // SVG (starts with "<?xml" or "<svg")
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x3c && bytes[1] === 0x3f) || (bytes[0] === 0x3c && bytes[1] === 0x73))
  ) return 'image/svg+xml';
  return 'application/octet-stream';
}

/** Revoke the Object URL stored for an asset (if any) so the underlying
 *  Blob can be garbage-collected. Safe no-op for `data:` URLs — `revoke`
 *  only matters for `blob:` URLs but is harmless on others. */
function revokeIfBlob(url: string | undefined) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function setCached(assetId: string, url: string) {
  const existing = cache.get(assetId);
  if (existing && existing !== url) revokeIfBlob(existing);
  cache.set(assetId, url);
}

/** Seed the cache directly — e.g. right after an upload when the caller
 *  already has an Object URL or data URL for the asset. Avoids an IPC
 *  round-trip on the re-render that follows. */
export function primeImageCache(assetId: string, url: string) {
  setCached(assetId, url);
  notify();
}

/** Revoke every Blob URL and empty the cache. Call on world close so the
 *  next world doesn't start with stale references from the previous one. */
export function clearImageCache() {
  for (const url of cache.values()) revokeIfBlob(url);
  cache.clear();
  pending.clear();
  notify();
}

export function useImageCache() {
  // Local tick: we re-render this hook instance whenever `notify()` fires
  // so `getImageUrl` picks up newly-cached URLs.
  const [, setTick] = useState(0);

  useEffect(() => {
    const sub = () => setTick((t) => t + 1);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  const getImageUrl = useCallback((assetId: string | null): string | null => {
    if (!assetId) return null;
    return cache.get(assetId) ?? null;
  }, []);

  const loadImages = useCallback(async (assetIds: (string | null)[]) => {
    const needed = assetIds.filter(
      (id): id is string => id != null && !cache.has(id) && !pending.has(id),
    );
    if (needed.length === 0) return;

    for (const id of needed) pending.add(id);

    // Parallel binary fetches. Per-asset IPC overhead is negligible on
    // localhost; this is still much faster than the old base64 JSON path.
    const results = await Promise.allSettled(
      needed.map(async (id) => {
        const buf = await commands.getAssetBytes(id);
        const bytes = new Uint8Array(buf);
        const mime = sniffImageMime(bytes);
        const blob = new Blob([bytes], { type: mime });
        return { id, url: URL.createObjectURL(blob) };
      }),
    );

    let changed = false;
    for (let i = 0; i < needed.length; i++) {
      const id = needed[i];
      pending.delete(id);
      const res = results[i];
      if (res.status === 'fulfilled') {
        setCached(res.value.id, res.value.url);
        changed = true;
      } else {
        console.error(`Failed to load asset ${id}:`, res.reason);
      }
    }
    if (changed) notify();
  }, []);

  const cacheSize = useCallback(() => cache.size, []);

  return { getImageUrl, loadImages, cacheSize };
}
