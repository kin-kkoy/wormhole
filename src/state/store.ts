import { create } from 'zustand';
import type { WorldSummary, WorldDetail } from '../lib/commands';
import { getSettingsStore } from '../lib/settings-store';

export type TabId = 'overview' | 'atlas' | 'characters' | 'lore';
export type OverviewTab = 'atlas' | 'characters' | 'lore';

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

  setWorlds: (worlds: WorldSummary[]) => void;
  setActiveWorld: (world: WorldDetail | null) => void;
  setActiveTab: (tab: TabId) => void;
  setOverviewTab: (tab: OverviewTab) => void;
  setEditMode: (on: boolean) => void;
  setSelectedCharacterId: (id: string | null) => void;
  setCardFlipped: (flipped: boolean) => void;
  setSelectedFolderId: (id: string | null) => void;
  setSelectedDocumentId: (id: string | null) => void;
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

  setWorlds: (worlds) => set({ worlds }),
  setActiveWorld: (world) => set({ activeWorld: world, activeTab: 'overview', selectedCharacterId: null, cardFlipped: false, editMode: false, selectedFolderId: null, selectedDocumentId: null }),
  setActiveTab: (tab) => set({ activeTab: tab, editMode: false, selectedCharacterId: null, cardFlipped: false, selectedFolderId: null, selectedDocumentId: null }),
  setSelectedCharacterId: (id) => set({ selectedCharacterId: id, editMode: false, cardFlipped: false }),
  setCardFlipped: (flipped) => set({ cardFlipped: flipped }),
  setSelectedFolderId: (id) => set({ selectedFolderId: id }),
  setSelectedDocumentId: (id) => set({ selectedDocumentId: id }),

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
