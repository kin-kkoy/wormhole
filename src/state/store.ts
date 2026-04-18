import { create } from 'zustand';
import type { WorldSummary, WorldDetail } from '../lib/commands';
import { getSettingsStore } from '../lib/settings-store';

export type TabId = 'overview' | 'atlas' | 'characters' | 'lore';
export type OverviewTab = 'atlas' | 'characters' | 'lore';
export type AtlasTool = 'select' | 'brush' | 'erase' | 'pan';
export type PeekEntityType = 'character' | 'map_entity' | 'lore_document';

export interface PeekTarget {
  entityType: PeekEntityType;
  entityId: string;
}

export interface PeekReturn {
  tab: TabId;
  selectedCharacterId: string | null;
  selectedDocumentId: string | null;
  selectedMapEntityId: string | null;
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
  // Atlas Canvas (Stage 5)
  selectedMapEntityId: string | null;
  atlasTool: AtlasTool;
  atlasBrushColor: string;
  atlasBrushSize: number;
  // Cross-system peek panel
  peekTarget: PeekTarget | null;
  peekReturn: PeekReturn | null;

  setWorlds: (worlds: WorldSummary[]) => void;
  setActiveWorld: (world: WorldDetail | null) => void;
  setActiveTab: (tab: TabId) => void;
  setOverviewTab: (tab: OverviewTab) => void;
  setEditMode: (on: boolean) => void;
  setSelectedCharacterId: (id: string | null) => void;
  setCardFlipped: (flipped: boolean) => void;
  setSelectedFolderId: (id: string | null) => void;
  setSelectedDocumentId: (id: string | null) => void;
  setSelectedMapEntityId: (id: string | null) => void;
  setAtlasTool: (tool: AtlasTool) => void;
  setAtlasBrushColor: (color: string) => void;
  setAtlasBrushSize: (size: number) => void;
  setPeekTarget: (target: PeekTarget | null) => void;
  openFullFromPeek: () => void;
  restoreFromPeekReturn: () => void;
  loadOverviewTab: () => Promise<void>;
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
  selectedMapEntityId: null,
  atlasTool: 'select',
  atlasBrushColor: '#d4a574',
  atlasBrushSize: 40,
  peekTarget: null,
  peekReturn: null,

  setWorlds: (worlds) => set({ worlds }),
  setActiveWorld: (world) =>
    set({
      activeWorld: world,
      activeTab: 'overview',
      selectedCharacterId: null,
      cardFlipped: false,
      editMode: false,
      selectedFolderId: null,
      selectedDocumentId: null,
      selectedMapEntityId: null,
      atlasTool: 'select',
      peekTarget: null,
      peekReturn: null,
    }),
  setActiveTab: (tab) =>
    set({
      activeTab: tab,
      editMode: false,
      selectedCharacterId: null,
      cardFlipped: false,
      selectedFolderId: null,
      selectedDocumentId: null,
      selectedMapEntityId: null,
      atlasTool: 'select',
      // Manual tab change cancels any pending "return to peek" affordance.
      peekReturn: null,
    }),
  setSelectedCharacterId: (id) => set({ selectedCharacterId: id, editMode: false, cardFlipped: false }),
  setCardFlipped: (flipped) => set({ cardFlipped: flipped }),
  setSelectedFolderId: (id) => set({ selectedFolderId: id }),
  setSelectedDocumentId: (id) => set({ selectedDocumentId: id }),
  setSelectedMapEntityId: (id) => set({ selectedMapEntityId: id }),
  setAtlasTool: (tool) => set({ atlasTool: tool }),
  setAtlasBrushColor: (color) => set({ atlasBrushColor: color }),
  setAtlasBrushSize: (size) => set({ atlasBrushSize: size }),

  setPeekTarget: (target) => set({ peekTarget: target }),

  openFullFromPeek: () =>
    set((state) => {
      const target = state.peekTarget;
      if (!target) return {};
      const snapshot: PeekReturn = {
        tab: state.activeTab,
        selectedCharacterId: state.selectedCharacterId,
        selectedDocumentId: state.selectedDocumentId,
        selectedMapEntityId: state.selectedMapEntityId,
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
      } else if (target.entityType === 'lore_document') {
        next.activeTab = 'lore';
        next.selectedDocumentId = target.entityId;
      } else {
        next.activeTab = 'atlas';
        next.selectedMapEntityId = target.entityId;
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
        selectedMapEntityId: ret.selectedMapEntityId,
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
}));
