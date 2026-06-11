/** Shared time helpers for the recycle bins and broken-link repair menu.
 *
 *  PURGE_WINDOW_MS must match the backend cleanup cutoff in
 *  `src-tauri/src/db.rs` (`run_recycle_bin_cleanup`, chrono Duration::hours(24)).
 *  Cleanup runs at app startup, so an expired item survives until next launch.
 */

export const PURGE_WINDOW_MS = 24 * 3_600_000;

/** Countdown chips turn urgent (red) below this remaining time. */
const URGENT_MS = 3 * 3_600_000;

const RTF =
  typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
    ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    : null;

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = then - Date.now();
  const absSec = Math.abs(diffMs) / 1000;
  if (!RTF) return new Date(iso).toLocaleString();
  if (absSec < 60) return RTF.format(Math.round(diffMs / 1000), 'second');
  if (absSec < 3600) return RTF.format(Math.round(diffMs / 60000), 'minute');
  if (absSec < 86400) return RTF.format(Math.round(diffMs / 3600000), 'hour');
  return RTF.format(Math.round(diffMs / 86400000), 'day');
}

export function absoluteTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export interface PurgeCountdown {
  state: 'normal' | 'urgent' | 'expired';
  label: string;
}

/** Time remaining before the 24h purge window closes on a soft-deleted item. */
export function purgeCountdown(deletedAtIso: string, nowMs: number): PurgeCountdown {
  const deletedAt = new Date(deletedAtIso).getTime();
  if (Number.isNaN(deletedAt)) return { state: 'expired', label: 'purges on next launch' };
  const msLeft = deletedAt + PURGE_WINDOW_MS - nowMs;
  if (msLeft <= 0) return { state: 'expired', label: 'purges on next launch' };

  const hours = Math.floor(msLeft / 3_600_000);
  const minutes = Math.floor((msLeft % 3_600_000) / 60_000);
  if (msLeft < URGENT_MS) {
    const label =
      hours > 0 ? `purges in ${hours}h ${minutes}m` : `purges in ${Math.max(1, minutes)}m`;
    return { state: 'urgent', label };
  }
  return { state: 'normal', label: `purges in ${hours}h` };
}

/** How long a deleted target has been in the bin + how long it has left.
 *  Used by the broken-link repair menu header. */
export function binStatusLine(deletedAtIso: string, nowMs: number): string {
  const deletedAt = new Date(deletedAtIso).getTime();
  if (Number.isNaN(deletedAt)) return 'Target deleted';
  const agoMs = nowMs - deletedAt;
  const agoH = Math.floor(agoMs / 3_600_000);
  const agoM = Math.floor((agoMs % 3_600_000) / 60_000);
  const ago = agoH > 0 ? `${agoH}h` : `${Math.max(1, agoM)}m`;
  const cd = purgeCountdown(deletedAtIso, nowMs);
  const left =
    cd.state === 'expired'
      ? 'purges on next launch'
      : cd.label.replace('purges in', 'in recycle bin') + ' more';
  return `Target deleted ${ago} ago · ${left}`;
}
