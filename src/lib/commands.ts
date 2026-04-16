import { invoke } from '@tauri-apps/api/core';

export interface AppConfig {
  storage_folder: string | null;
}

export interface WorldSummary {
  id: string;
  title: string;
  world_type: string;
  summary: string | null;
  cover_thumbnail_base64: string | null;
  last_opened: string | null;
  created_at: string;
}

export interface WorldDetail {
  id: string;
  title: string;
  world_type: string;
  summary: string | null;
  cover_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetData {
  id: string;
  file_name: string;
  mime_type: string;
  data_base64: string;
}

export interface OverviewRecord {
  id: string;
  title: string;
  updated_at: string;
}

export interface SystemOverview {
  count: number;
  recent: OverviewRecord[];
}

export interface WorldOverviewData {
  characters: SystemOverview;
  atlas: SystemOverview;
  lore: SystemOverview;
}

// ─── Graph types ──────────────────────────────────────────────────────────────

export interface AtlasNodeData {
  id: string;
  title: string;
  entity_type: string;
  parent_map_entity_id: string | null;
  image_asset_id: string | null;
  tags_text: string | null;
}

export interface EntityLinkData {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  link_type: string;
}

export interface SharedNodeData {
  id: string;
  name: string;
  color: string | null;
  font_style: string;
  font_size: number;
  auto_generated: boolean;
  source_tag: string | null;
  hidden: boolean;
  member_ids: string[];
}

export interface AtlasGraphData {
  entities: AtlasNodeData[];
  links: EntityLinkData[];
  shared_nodes: SharedNodeData[];
}

export interface CharacterNodeData {
  id: string;
  name: string;
  image_asset_id: string | null;
  tags_text: string | null;
}

export interface CharacterLocationLink {
  character_id: string;
  map_entity_id: string;
  map_entity_title: string;
  link_type: string;
}

export interface CharactersGraphData {
  characters: CharacterNodeData[];
  location_links: CharacterLocationLink[];
  shared_nodes: SharedNodeData[];
}

export interface LoreFolderData {
  id: string;
  title: string;
  parent_folder_id: string | null;
}

export interface LoreDocumentData {
  id: string;
  title: string;
  folder_id: string | null;
}

export interface LoreGraphData {
  folders: LoreFolderData[];
  documents: LoreDocumentData[];
}

export interface AssetBatchItem {
  id: string;
  file_name: string;
  mime_type: string;
  data_base64: string;
}

// ─── Character types ─────────────────────────────────────────────────────────

export interface CharacterSummary {
  id: string;
  name: string;
  short_role: string | null;
  image_asset_id: string | null;
  decorative_ribbon: string | null;
  card_layout_variant: string;
  tags_text: string | null;
  sort_order: number | null;
}

export interface CharacterFull {
  id: string;
  world_id: string;
  image_asset_id: string | null;
  name: string;
  short_role: string | null;
  objective_summary: string | null;
  in_character_intro: string | null;
  decorative_ribbon: string | null;
  traits_text: string | null;
  card_layout_variant: string;
  brief_details_json: string | null;
  tags_text: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface CardBlock {
  id: string;
  character_id: string;
  title: string;
  content: string;
  grid_column: number;
  grid_row: number;
  col_span: number;
  row_span: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BlockPositionUpdate {
  id: string;
  grid_column: number;
  grid_row: number;
  col_span: number;
  row_span: number;
}

export interface DetailSection {
  id: string;
  character_id: string;
  title: string;
  layout_type: string;
  content: string | null;
  structured_content_json: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── Lore types ──────────────────────────────────────────────────────────────

export interface LoreFolder {
  id: string;
  world_id: string;
  parent_folder_id: string | null;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LoreDocumentSummary {
  id: string;
  world_id: string;
  folder_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface LoreDocumentFull {
  id: string;
  world_id: string;
  folder_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ─── Entity Link types ──────────────────────────────────────────────────────

export interface EntityLink {
  id: string;
  world_id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  link_type: string;
  created_at: string;
}

export interface LinkedRecordDisplay {
  link_id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  link_type: string;
}

export interface LinkableRecord {
  id: string;
  entity_type: string;
  name: string;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export const commands = {
  getAppConfig: () => invoke<AppConfig>('get_app_config'),

  setStorageFolder: (path: string) =>
    invoke<void>('set_storage_folder', { path }),

  createWorld: (title: string, worldType: string, summary?: string) =>
    invoke<WorldSummary>('create_world', { title, worldType, summary: summary ?? null }),

  listWorlds: () => invoke<WorldSummary[]>('list_worlds'),

  openWorld: (worldId: string) =>
    invoke<WorldDetail>('open_world', { worldId }),

  closeWorld: () => invoke<void>('close_world'),

  deleteWorld: (worldId: string) =>
    invoke<void>('delete_world', { worldId }),

  seedExampleWorld: () => invoke<WorldSummary>('seed_example_world'),

  updateWorld: (params: {
    title?: string;
    summary?: string;
    worldType?: string;
    coverAssetId?: string;
  }) =>
    invoke<WorldDetail>('update_world', {
      title: params.title ?? null,
      summary: params.summary ?? null,
      worldType: params.worldType ?? null,
      coverAssetId: params.coverAssetId ?? null,
    }),

  importAsset: (filePath: string) =>
    invoke<string>('import_asset', { filePath }),

  getAsset: (assetId: string) =>
    invoke<AssetData>('get_asset', { assetId }),

  getWorldOverview: () =>
    invoke<WorldOverviewData>('get_world_overview'),

  // Graph data
  getAtlasGraphData: () =>
    invoke<AtlasGraphData>('get_atlas_graph_data'),

  getCharactersGraphData: () =>
    invoke<CharactersGraphData>('get_characters_graph_data'),

  getLoreGraphData: () =>
    invoke<LoreGraphData>('get_lore_graph_data'),

  // Shared nodes
  createSharedNode: (params: {
    graphType: string;
    name: string;
    color?: string;
    fontStyle?: string;
    fontSize?: number;
  }) =>
    invoke<SharedNodeData>('create_shared_node', {
      graphType: params.graphType,
      name: params.name,
      color: params.color ?? null,
      fontStyle: params.fontStyle ?? null,
      fontSize: params.fontSize ?? null,
    }),

  updateSharedNode: (params: {
    id: string;
    name?: string;
    color?: string;
    fontStyle?: string;
    fontSize?: number;
    hidden?: boolean;
  }) =>
    invoke<SharedNodeData>('update_shared_node', {
      id: params.id,
      name: params.name ?? null,
      color: params.color ?? null,
      fontStyle: params.fontStyle ?? null,
      fontSize: params.fontSize ?? null,
      hidden: params.hidden ?? null,
    }),

  deleteSharedNode: (id: string) =>
    invoke<void>('delete_shared_node', { id }),

  addSharedNodeMember: (sharedNodeId: string, entityType: string, entityId: string) =>
    invoke<string>('add_shared_node_member', { sharedNodeId, entityType, entityId }),

  removeSharedNodeMember: (sharedNodeId: string, entityId: string) =>
    invoke<void>('remove_shared_node_member', { sharedNodeId, entityId }),

  autoDetectSharedNodes: (graphType: string) =>
    invoke<SharedNodeData[]>('auto_detect_shared_nodes', { graphType }),

  getAssetBatch: (assetIds: string[]) =>
    invoke<AssetBatchItem[]>('get_asset_batch', { assetIds }),

  // ─── Characters ──────────────────────────────────────────────────────────────

  listCharacters: () =>
    invoke<CharacterSummary[]>('list_characters'),

  getCharacter: (characterId: string) =>
    invoke<CharacterFull>('get_character', { characterId }),

  createCharacter: (params: {
    name: string;
    shortRole?: string;
    imageAssetId?: string;
    cardLayoutVariant?: string;
    tagsText?: string;
  }) =>
    invoke<CharacterFull>('create_character', {
      name: params.name,
      shortRole: params.shortRole ?? null,
      imageAssetId: params.imageAssetId ?? null,
      cardLayoutVariant: params.cardLayoutVariant ?? null,
      tagsText: params.tagsText ?? null,
    }),

  updateCharacter: (params: {
    characterId: string;
    name?: string;
    shortRole?: string;
    objectiveSummary?: string;
    inCharacterIntro?: string;
    decorativeRibbon?: string;
    traitsText?: string;
    cardLayoutVariant?: string;
    briefDetailsJson?: string;
    imageAssetId?: string;
    tagsText?: string;
  }) =>
    invoke<CharacterFull>('update_character', {
      characterId: params.characterId,
      name: params.name ?? null,
      shortRole: params.shortRole ?? null,
      objectiveSummary: params.objectiveSummary ?? null,
      inCharacterIntro: params.inCharacterIntro ?? null,
      decorativeRibbon: params.decorativeRibbon ?? null,
      traitsText: params.traitsText ?? null,
      cardLayoutVariant: params.cardLayoutVariant ?? null,
      briefDetailsJson: params.briefDetailsJson ?? null,
      imageAssetId: params.imageAssetId ?? null,
      tagsText: params.tagsText ?? null,
    }),

  deleteCharacter: (characterId: string) =>
    invoke<void>('delete_character', { characterId }),

  restoreCharacter: (characterId: string) =>
    invoke<CharacterFull>('restore_character', { characterId }),

  reorderCharacters: (characterIds: string[]) =>
    invoke<void>('reorder_characters', { characterIds }),

  // ─── Card Blocks ─────────────────────────────────────────────────────────────

  listCardBlocks: (characterId: string) =>
    invoke<CardBlock[]>('list_card_blocks', { characterId }),

  createCardBlock: (params: {
    characterId: string;
    title: string;
    gridColumn: number;
    gridRow: number;
    colSpan?: number;
    rowSpan?: number;
  }) =>
    invoke<CardBlock>('create_card_block', {
      characterId: params.characterId,
      title: params.title,
      gridColumn: params.gridColumn,
      gridRow: params.gridRow,
      colSpan: params.colSpan ?? null,
      rowSpan: params.rowSpan ?? null,
    }),

  updateCardBlock: (params: {
    blockId: string;
    title?: string;
    content?: string;
    gridColumn?: number;
    gridRow?: number;
    colSpan?: number;
    rowSpan?: number;
  }) =>
    invoke<CardBlock>('update_card_block', {
      blockId: params.blockId,
      title: params.title ?? null,
      content: params.content ?? null,
      gridColumn: params.gridColumn ?? null,
      gridRow: params.gridRow ?? null,
      colSpan: params.colSpan ?? null,
      rowSpan: params.rowSpan ?? null,
    }),

  deleteCardBlock: (blockId: string) =>
    invoke<void>('delete_card_block', { blockId }),

  batchUpdateBlockPositions: (updates: BlockPositionUpdate[]) =>
    invoke<void>('batch_update_block_positions', { updates }),

  // ─── Detail Sections ─────────────────────────────────────────────────────────

  listDetailSections: (characterId: string) =>
    invoke<DetailSection[]>('list_detail_sections', { characterId }),

  createDetailSection: (params: {
    characterId: string;
    title: string;
    layoutType: string;
  }) =>
    invoke<DetailSection>('create_detail_section', {
      characterId: params.characterId,
      title: params.title,
      layoutType: params.layoutType,
    }),

  updateDetailSection: (params: {
    sectionId: string;
    title?: string;
    layoutType?: string;
    content?: string;
    structuredContentJson?: string;
  }) =>
    invoke<DetailSection>('update_detail_section', {
      sectionId: params.sectionId,
      title: params.title ?? null,
      layoutType: params.layoutType ?? null,
      content: params.content ?? null,
      structuredContentJson: params.structuredContentJson ?? null,
    }),

  deleteDetailSection: (sectionId: string) =>
    invoke<void>('delete_detail_section', { sectionId }),

  reorderDetailSections: (sectionIds: string[]) =>
    invoke<void>('reorder_detail_sections', { sectionIds }),

  // ─── Lore Folders ─────────────────────────────────────────────────────────────

  listLoreFolders: () =>
    invoke<LoreFolder[]>('list_lore_folders'),

  createLoreFolder: (params: { title: string; parentFolderId?: string }) =>
    invoke<LoreFolder>('create_lore_folder', {
      title: params.title,
      parentFolderId: params.parentFolderId ?? null,
    }),

  renameLoreFolder: (folderId: string, title: string) =>
    invoke<LoreFolder>('rename_lore_folder', { folderId, title }),

  deleteLoreFolder: (folderId: string) =>
    invoke<void>('delete_lore_folder', { folderId }),

  getFolderDocCount: (folderId: string) =>
    invoke<number>('get_folder_doc_count', { folderId }),

  moveLoreFolder: (params: { folderId: string; newParentFolderId?: string; sortOrder: number }) =>
    invoke<LoreFolder>('move_lore_folder', {
      folderId: params.folderId,
      newParentFolderId: params.newParentFolderId ?? null,
      sortOrder: params.sortOrder,
    }),

  reorderLoreFolders: (folderIds: string[]) =>
    invoke<void>('reorder_lore_folders', { folderIds }),

  // ─── Lore Documents ──────────────────────────────────────────────────────────

  listLoreDocuments: () =>
    invoke<LoreDocumentSummary[]>('list_lore_documents'),

  createLoreDocument: (params: { title: string; folderId?: string }) =>
    invoke<LoreDocumentFull>('create_lore_document', {
      title: params.title,
      folderId: params.folderId ?? null,
    }),

  getLoreDocument: (documentId: string) =>
    invoke<LoreDocumentFull>('get_lore_document', { documentId }),

  updateLoreDocument: (params: {
    documentId: string;
    title?: string;
    content?: string;
    folderId?: string;
  }) =>
    invoke<LoreDocumentFull>('update_lore_document', {
      documentId: params.documentId,
      title: params.title ?? null,
      content: params.content ?? null,
      folderId: params.folderId ?? null,
    }),

  deleteLoreDocument: (documentId: string) =>
    invoke<void>('delete_lore_document', { documentId }),

  restoreLoreDocument: (documentId: string) =>
    invoke<LoreDocumentFull>('restore_lore_document', { documentId }),

  moveLoreDocument: (documentId: string, folderId: string | null) =>
    invoke<void>('move_lore_document', { documentId, folderId }),

  // ─── Entity Links ────────────────────────────────────────────────────────────

  listEntityLinks: (entityType: string, entityId: string) =>
    invoke<LinkedRecordDisplay[]>('list_entity_links', { entityType, entityId }),

  createEntityLink: (params: {
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    linkType?: string;
  }) =>
    invoke<EntityLink>('create_entity_link', {
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      targetType: params.targetType,
      targetId: params.targetId,
      linkType: params.linkType ?? null,
    }),

  deleteEntityLink: (linkId: string) =>
    invoke<void>('delete_entity_link', { linkId }),

  searchLinkableRecords: (params: { query: string; excludeType?: string; excludeId?: string }) =>
    invoke<LinkableRecord[]>('search_linkable_records', {
      query: params.query,
      excludeType: params.excludeType ?? null,
      excludeId: params.excludeId ?? null,
    }),
};
