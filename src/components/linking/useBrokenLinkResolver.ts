import { useEffect } from 'react';
import { commands } from '../../lib/commands';

const BROKEN_ATTR = 'data-broken';

// Module-scope subscriber set — any component that wants to trigger a
// re-scan (e.g. after deleting a record) calls `invalidateBrokenLinks()`
// which bumps the running resolver if one is mounted.
const resolvers = new Set<() => void>();

/**
 * Force every mounted `useBrokenLinkResolver` instance to re-scan the DOM.
 * Call after any record delete / restore so stale spans get re-checked
 * without waiting for a DOM mutation to trip the observer.
 */
export function invalidateBrokenLinks() {
  for (const fn of resolvers) fn();
}

/**
 * Scan the document for inline-link spans and toggle `data-broken="1"` on
 * any whose target is deleted or missing. The TipTapEditor stylesheet picks
 * up that attribute to render strikethrough + darker entity-type color.
 *
 * Runs on:
 *   - mount (initial pass),
 *   - DOM mutations (new editors / new link spans),
 *   - window focus (user came back from another window),
 *   - explicit `invalidateBrokenLinks()` calls from delete/restore paths.
 *
 * Unlike the previous version, this resolver is **bidirectional**: it adds
 * `data-broken` when the target is missing AND removes it when the target
 * comes back. We query every link on every scan so mid-session state flips
 * (delete, restore, rename) reflect immediately.
 */
export function useBrokenLinkResolver() {
  useEffect(() => {
    let scheduled = false;
    let cancelled = false;

    const scan = async () => {
      scheduled = false;
      if (cancelled) return;

      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>('[data-inline-link]'),
      );
      if (nodes.length === 0) return;

      type Ref = { node: HTMLElement; entityType: string; entityId: string };
      const refs: Ref[] = [];
      for (const n of nodes) {
        const entityType = n.dataset.entityType;
        const entityId = n.dataset.entityId;
        if (!entityType || !entityId) continue;
        refs.push({ node: n, entityType, entityId });
      }
      if (refs.length === 0) return;

      // Dedupe by (type,id) so we don't pay for the same lookup multiple
      // times when a doc references the same entity in several places.
      const seen = new Set<string>();
      const payload: { entity_type: string; entity_id: string }[] = [];
      for (const r of refs) {
        const key = `${r.entityType}:${r.entityId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        payload.push({ entity_type: r.entityType, entity_id: r.entityId });
      }

      let resolutions;
      try {
        resolutions = await commands.resolveInlineLinks(payload);
      } catch (e) {
        console.error('Failed to resolve inline links:', e);
        return;
      }
      if (cancelled) return;

      const lookup = new Map<string, { exists: boolean; name: string }>();
      for (const r of resolutions) {
        lookup.set(`${r.entity_type}:${r.entity_id}`, { exists: r.exists, name: r.name });
      }

      for (const ref of refs) {
        const r = lookup.get(`${ref.entityType}:${ref.entityId}`);
        if (!r || !r.exists) {
          // Broken: target deleted or never existed.
          ref.node.setAttribute(BROKEN_ATTR, '1');
          ref.node.setAttribute('title', 'Record deleted');
          if (!ref.node.textContent || ref.node.textContent.trim().length === 0) {
            ref.node.textContent = '[deleted]';
          }
        } else {
          // Healthy — make sure we don't have a stale broken flag from a
          // previous scan where the record didn't yet exist or was deleted
          // and then restored.
          if (ref.node.hasAttribute(BROKEN_ATTR)) {
            ref.node.removeAttribute(BROKEN_ATTR);
          }
          // Refresh label if the record was renamed since the link was authored.
          if (r.name && ref.node.textContent !== r.name) {
            ref.node.textContent = r.name;
          }
          // Restore the natural tooltip (title attr) in case we had flipped
          // it to "Record deleted" earlier.
          const t = `${ref.entityType}: ${r.name}`;
          if (ref.node.getAttribute('title') !== t) {
            ref.node.setAttribute('title', t);
          }
        }
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(scan, 80);
    };

    // Initial scan.
    schedule();

    // Re-scan when the editor DOM changes (new documents opened, new links
    // typed, peek panel rendered, etc.).
    const observer = new MutationObserver(() => schedule());
    observer.observe(document.body, { childList: true, subtree: true });

    // Re-scan when the app window regains focus — catches the common flow
    // of "delete a record in another tab, come back to the document, expect
    // its links to show the updated state".
    const onFocus = () => schedule();
    window.addEventListener('focus', onFocus);

    // Register as a global invalidation target.
    resolvers.add(schedule);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener('focus', onFocus);
      resolvers.delete(schedule);
    };
  }, []);
}
