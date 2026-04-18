import { useEffect } from 'react';
import { useAppStore, type PeekEntityType, type TabId } from '../../state/store';

/**
 * Map clicked entity type → in-system tab. Used to decide whether to open the
 * peek panel or navigate in-place ("same-system exception" from spec §14).
 */
const SYSTEM_TAB: Record<PeekEntityType, TabId> = {
  character: 'characters',
  map_entity: 'atlas',
  lore_document: 'lore',
};

const VALID_ENTITY_TYPES: PeekEntityType[] = ['character', 'map_entity', 'lore_document'];

function isInlineLink(el: HTMLElement | null): el is HTMLElement {
  return !!el && (el.hasAttribute('data-inline-link') || el.hasAttribute('data-peek-link'));
}

/**
 * Global click delegate for inline `[[links]]` and other peek-routed entity
 * references. Mounts once at the WorldShell level so any rendered span with
 * `data-inline-link` (TipTap atom nodes) or any element decorated with
 * `data-peek-link` (linked-records rows) routes through one central handler.
 *
 * Behaviour:
 *  - clicks on an inline-link span ALWAYS navigate (peek or in-place), even
 *    inside a contenteditable TipTap surface. The user can still delete an
 *    inline link via cursor + Backspace; click is reserved for navigation.
 *  - broken refs (`data-broken="1"`) are ignored
 *  - same-system clicks navigate in-place; cross-system clicks open peek
 *
 * We also intercept `mousedown` on inline links (capture phase) to preempt
 * ProseMirror's atom-node selection — without this, the editor would set a
 * node selection on mousedown before our click handler navigates, leaving the
 * user with a selected atom node when they return to the doc.
 */
export function useInlineLinkClicks() {
  const setPeekTarget = useAppStore((s) => s.setPeekTarget);
  const setSelectedCharacterId = useAppStore((s) => s.setSelectedCharacterId);
  const setSelectedDocumentId = useAppStore((s) => s.setSelectedDocumentId);
  const setSelectedMapEntityId = useAppStore((s) => s.setSelectedMapEntityId);

  useEffect(() => {
    function findLink(target: EventTarget | null): HTMLElement | null {
      const el = target as HTMLElement | null;
      if (!el || typeof el.closest !== 'function') return null;
      return el.closest<HTMLElement>('[data-inline-link], [data-peek-link]');
    }

    function onMouseDown(e: MouseEvent) {
      // Only suppress for left-click and only inside a contenteditable surface
      // — outside an editor (peek panel, linked records list) the default has
      // no effect we care about.
      if (e.button !== 0) return;
      const link = findLink(e.target);
      if (!isInlineLink(link)) return;
      if (!link.closest('[contenteditable="true"]')) return;
      // Block ProseMirror from setting a node selection on the atom node.
      e.preventDefault();
    }

    function onClick(e: MouseEvent) {
      if (e.button !== 0) return;
      const link = findLink(e.target);
      if (!isInlineLink(link)) return;

      // Don't intercept if the user clicked a child action (e.g. the X remove
      // button inside a linked-records row). Those handlers stop propagation
      // before reaching here, but defensively skip if the click target is a
      // descendant button outside the link's clickable surface.
      const directTarget = e.target as HTMLElement;
      if (
        directTarget !== link &&
        directTarget.closest('button, [role="button"]') &&
        directTarget.closest('button, [role="button"]') !== link
      ) {
        return;
      }

      if (link.dataset.broken === '1') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const entityType = link.dataset.entityType as PeekEntityType | undefined;
      const entityId = link.dataset.entityId;
      if (!entityType || !entityId) return;
      if (!VALID_ENTITY_TYPES.includes(entityType)) return;

      e.preventDefault();
      e.stopPropagation();

      const state = useAppStore.getState();
      const targetTab = SYSTEM_TAB[entityType];

      // Same-system exception: navigate in-place rather than open peek.
      if (state.activeTab === targetTab) {
        if (entityType === 'character') setSelectedCharacterId(entityId);
        else if (entityType === 'lore_document') setSelectedDocumentId(entityId);
        else setSelectedMapEntityId(entityId);

        // Replace any open peek so we don't leave a stale panel hovering.
        if (state.peekTarget) setPeekTarget(null);
        return;
      }

      // Cross-system: replace any prior peek with the new target. Also clear
      // peekReturn so an unrelated "back" affordance doesn't linger when the
      // user navigates via a fresh peek instead of via the back button.
      if (state.peekReturn) useAppStore.setState({ peekReturn: null });
      setPeekTarget({ entityType, entityId });
    }

    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('click', onClick, true);
    };
    // setters are stable refs from zustand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
