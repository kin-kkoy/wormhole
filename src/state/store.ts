import { create } from 'zustand';
import type { WorldSummary, WorldDetail } from '../lib/commands';
import { getSettingsStore } from '../lib/settings-store';

// NOTE: the 'atlas' tab/sub-tab render an "In Development" placeholder — the
// Atlas Canvas system is detached for redesign (see
// references/atlas-2d-foundation.md for the forward architecture).
export type TabId = 'overview' | 'atlas' | 'characters' | 'lore';
export type OverviewTab = 'atlas' | 'characters' | 'lore';
export type LoreMode = 'edit' | 'read';
/** Read-mode page layout. Paginated = CSS-columns sub-paging within a doc;
 *  Continuous = single scrolling surface (infinite-scroll feel). */
export type ReaderLayout = 'paginated' | 'continuous';
/** Synthetic book id for documents with no folder — they appear as a "Loose Pages" book. */
export const LOOSE_BOOK_ID = '__loose__';
/** Virtual path segment that represents a drilled-into "stack" of loose docs
 *  at the parent folder's level. When this is the last segment of
 *  activeFolderPath, the view shows each previously-stacked doc as an
 *  individual PageTile. */
export const STACK_SEGMENT = '__stack__';
export type PeekEntityType = 'character' | 'lore_document';

export interface PeekTarget {
  entityType: PeekEntityType;
  entityId: string;
}

export interface PeekReturn {
  tab: TabId;
  selectedCharacterId: string | null;
  selectedDocumentId: string | null;
  peekTarget: PeekTarget | null;
}

interface AppState {
  worlds: WorldSummary[];
  activeWorld: WorldDetail | null;
  activeTab: TabId;
  overviewTab: OverviewTab;
  editMode: boolean;
  selectedCharacterId: string | null;
  cardFlipped: boolean;
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  // Lore Archive — Read vs Write mode
  loreMode: LoreMode;
  /** Drill-down path through the library. Empty = root library (books as
   *  tiles). `[rootFolderId]` = a book is opened. Deeper = nested sub-books.
   *  May end with STACK_SEGMENT to represent an expanded loose-doc stack. */
  activeFolderPath: string[];
  readerLayout: ReaderLayout;
  /** Read-mode TOC sidebar collapsed state. Persists across sessions. */
  tocCollapsed: boolean;
  // Cross-system peek panel
  peekTarget: PeekTarget | null;
  peekReturn: PeekReturn | null;
  /** Staged "resume where you left off" destination from the world index.
   *  Applied by WorldShell AFTER the world opens — setActiveWorld resets
   *  tab/selection state, so staging directly would be clobbered. Scoped to
   *  a worldId (and cleared only on application) so StrictMode's double
   *  mount/cleanup cycle can't wipe it before it lands, and so it can never
   *  leak into a different world. */
  pendingResume: {
    worldId: string;
    tab: TabId;
    entityType: 'character' | 'lore_document' | null;
    entityId: string | null;
    /** Staging time — the resume is only honored briefly after the click,
     *  so a stale stage can never hijack a later plain world open. */
    stagedAt: number;
  } | null;

  setWorlds: (worlds: WorldSummary[]) => void;
  setActiveWorld: (world: WorldDetail | null) => void;
  setActiveTab: (tab: TabId) => void;
  setOverviewTab: (tab: OverviewTab) => void;
  setEditMode: (on: boolean) => void;
  setSelectedCharacterId: (id: string | null) => void;
  setCardFlipped: (flipped: boolean) => void;
  setSelectedFolderId: (id: string | null) => void;
  setSelectedDocumentId: (id: string | null) => void;
  setPendingResume: (resume: AppState['pendingResume']) => void;
  setPeekTarget: (target: PeekTarget | null) => void;
  openFullFromPeek: () => void;
  restoreFromPeekReturn: () => void;
  loadOverviewTab: () => Promise<void>;
  setLoreMode: (mode: LoreMode) => void;
  setActiveFolderPath: (path: string[]) => void;
  pushFolderPath: (segment: string) => void;
  popFolderPathTo: (depth: number) => void;
  loadLoreMode: () => Promise<void>;
  setReaderLayout: (layout: ReaderLayout) => void;
  loadReaderLayout: () => Promise<void>;
  setTocCollapsed: (collapsed: boolean) => void;
  loadTocCollapsed: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  worlds: [],
  activeWorld: null,
  activeTab: 'overview',
  overviewTab: 'atlas',
  editMode: false,
  selectedCharacterId: null,
  cardFlipped: false,
  selectedFolderId: null,
  selectedDocumentId: null,
  loreMode: 'read',
  activeFolderPath: [],
  readerLayout: 'paginated',
  tocCollapsed: false,
  peekTarget: null,
  peekReturn: null,
  pendingResume: null,

  setWorlds: (worlds) => set({ worlds }),
  setPendingResume: (resume) => set({ pendingResume: resume }),
  setActiveWorld: (world) =>
    set((state) => {
      // "Resume where you left off": consume a fresh staged resume for THIS
      // world. Consumed idempotently and NOT cleared here — React StrictMode
      // mounts WorldShell twice in dev, so open_world resolves twice and the
      // second setActiveWorld must re-apply the same destination instead of
      // resetting to Overview. The freshness window keeps a leftover stage
      // from hijacking a later, ordinary world open.
      const pr = state.pendingResume;
      const resume =
        world && pr && pr.worldId === world.id && Date.now() - pr.stagedAt < 8000
          ? pr
          : null;
      return {
        activeWorld: world,
        activeTab: resume ? resume.tab : 'overview',
        selectedCharacterId:
          resume && resume.entityType === 'character' ? resume.entityId : null,
        cardFlipped: false,
        editMode: false,
        selectedFolderId: null,
        selectedDocumentId:
          resume && resume.entityType === 'lore_document' ? resume.entityId : null,
        activeFolderPath: [],
        peekTarget: null,
        peekReturn: null,
      };
    }),
  setActiveTab: (tab) =>
    set({
      activeTab: tab,
      editMode: false,
      selectedCharacterId: null,
      cardFlipped: false,
      selectedFolderId: null,
      selectedDocumentId: null,
      activeFolderPath: [],
      // Manual tab change cancels any pending "return to peek" affordance.
      peekReturn: null,
    }),
  setSelectedCharacterId: (id) => set({ selectedCharacterId: id, editMode: false, cardFlipped: false }),
  setCardFlipped: (flipped) => set({ cardFlipped: flipped }),
  setSelectedFolderId: (id) => set({ selectedFolderId: id }),
  setSelectedDocumentId: (id) => set({ selectedDocumentId: id }),

  setPeekTarget: (target) => set({ peekTarget: target }),

  openFullFromPeek: () =>
    set((state) => {
      const target = state.peekTarget;
      if (!target) return {};
      const snapshot: PeekReturn = {
        tab: state.activeTab,
        selectedCharacterId: state.selectedCharacterId,
        selectedDocumentId: state.selectedDocumentId,
        peekTarget: target,
      };
      const next: Partial<AppState> = {
        peekReturn: snapshot,
        peekTarget: null,
        editMode: false,
      };
      if (target.entityType === 'character') {
        next.activeTab = 'characters';
        next.selectedCharacterId = target.entityId;
        next.cardFlipped = false;
      } else {
        next.activeTab = 'lore';
        next.selectedDocumentId = target.entityId;
      }
      return next;
    }),

  restoreFromPeekReturn: () =>
    set((state) => {
      const ret = state.peekReturn;
      if (!ret) return {};
      return {
        activeTab: ret.tab,
        selectedCharacterId: ret.selectedCharacterId,
        selectedDocumentId: ret.selectedDocumentId,
        peekTarget: ret.peekTarget,
        peekReturn: null,
        editMode: false,
        cardFlipped: false,
      };
    }),

  setOverviewTab: (tab) => {
    set({ overviewTab: tab, editMode: false });
    getSettingsStore().then(async (store) => {
      await store.set('overviewTab', tab);
      await store.save();
    }).catch(console.error);
  },

  setEditMode: (on) => set({ editMode: on }),

  loadOverviewTab: async () => {
    try {
      const store = await getSettingsStore();
      const saved = await store.get<string>('overviewTab');
      if (saved === 'atlas' || saved === 'characters' || saved === 'lore') {
        set({ overviewTab: saved as OverviewTab });
      }
    } catch {
      // Keep default
    }
  },

  setLoreMode: (mode) => {
    set({ loreMode: mode });
    getSettingsStore().then(async (store) => {
      await store.set('loreMode', mode);
      await store.save();
    }).catch(console.error);
  },

  setActiveFolderPath: (path) => set({ activeFolderPath: path }),
  pushFolderPath: (segment) =>
    set((state) => ({ activeFolderPath: [...state.activeFolderPath, segment] })),
  popFolderPathTo: (depth) =>
    set((state) => ({ activeFolderPath: state.activeFolderPath.slice(0, depth) })),

  loadLoreMode: async () => {
    try {
      const store = await getSettingsStore();
      const saved = await store.get<string>('loreMode');
      if (saved === 'edit' || saved === 'read') {
        set({ loreMode: saved });
      }
    } catch {
      // Keep default ('read')
    }
  },

  setReaderLayout: (layout) => {
    set({ readerLayout: layout });
    getSettingsStore().then(async (store) => {
      await store.set('readerLayout', layout);
      await store.save();
    }).catch(console.error);
  },

  loadReaderLayout: async () => {
    try {
      const store = await getSettingsStore();
      const saved = await store.get<string>('readerLayout');
      if (saved === 'paginated' || saved === 'continuous') {
        set({ readerLayout: saved });
      }
    } catch {
      // Keep default ('paginated')
    }
  },

  setTocCollapsed: (collapsed) => {
    set({ tocCollapsed: collapsed });
    getSettingsStore().then(async (store) => {
      await store.set('tocCollapsed', collapsed);
      await store.save();
    }).catch(console.error);
  },

  loadTocCollapsed: async () => {
    try {
      const store = await getSettingsStore();
      const saved = await store.get<boolean>('tocCollapsed');
      if (typeof saved === 'boolean') {
        set({ tocCollapsed: saved });
      }
    } catch {
      // Keep default (false)
    }
  },
}));
