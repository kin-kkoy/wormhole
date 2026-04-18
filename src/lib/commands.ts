import { invoke } from '@tauri-apps/api/core';
import { invalidateBrokenLinks } from '../components/linking/useBrokenLinkResolver';

/** Fire-and-forget: after the invocation succeeds, nudge every mounted
 *  broken-link resolver to re-scan. Used to wrap delete / restore / purge
 *  commands so inline `[[links]]` flip to their new state without waiting
 *  for a DOM mutation or window refocus. */
function withLinkInvalidation<T>(p: Promise<T>): Promise<T> {
  return p.then((r) => {
    invalidateBrokenLinks();
    return r;
  });
}

function uint8ToBase64(bytes: Uint8Array): string {
  // Chunked conversion to avoid call-stack overflow on large arrays.
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

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
  /** When true, opening this character from the codex opens the cinematic
   *  (full-bleed image) view instead of the default card view. */
  cinematic_preview_locked: boolean;
  created_at: string;
  updated_at: string;
}

export type BlockType = 'standard' | 'label' | 'text';

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
  block_type: BlockType;
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

// ─── Atlas types (Stage 5) ───────────────────────────────────────────────────

export interface MapEntityFull {
  id: string;
  world_id: string;
  parent_map_entity_id: string | null;
  entity_type: string;
  title: string;
  description: string | null;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  style_token: string | null;
  tags_text: string | null;
  image_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaintLayerData {
  data_base64: string | null;
  mime_type: string;
  updated_at: string | null;
}

export type MapEntityType =
  | 'region'
  | 'settlement'
  | 'landmark'
  | 'district'
  | 'infrastructure';

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

export interface InlineLinkRef {
  entity_type: string;
  entity_id: string;
}

export interface InlineLinkResolution {
  entity_type: string;
  entity_id: string;
  exists: boolean;
  name: string;
}

// ─── Search & Recycle Bin ─────────────────────────────────────────────────────

export type SearchRecordType = 'character' | 'map_entity' | 'lore_document';

export interface SearchResult {
  record_type: SearchRecordType;
  id: string;
  title: string;
  snippet: string;
}

export interface DeletedCharacter {
  id: string;
  name: string;
  deleted_at: string;
}

export interface DeletedMapEntity {
  id: string;
  title: string;
  deleted_at: string;
}

export interface DeletedLoreDocument {
  id: string;
  title: string;
  deleted_at: string;
}

export interface DeletedLoreFolder {
  id: string;
  title: string;
  deleted_at: string;
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

  importAsset: (filePath: string, maxBytes?: number) =>
    invoke<string>('import_asset', { filePath, maxBytes: maxBytes ?? null }),

  getAsset: (assetId: string) =>
    invoke<AssetData>('get_asset', { assetId }),

  /** Binary fetch — returns the raw asset bytes as an ArrayBuffer.
   *  Prefer this over getAsset for image display: skips base64 encoding
   *  and the multi-MB JSON string parsing that makes `getAsset` slow. */
  getAssetBytes: (assetId: string) =>
    invoke<ArrayBuffer>('get_asset_bytes', { assetId }),

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
    cinematicPreviewLocked?: boolean;
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
      cinematicPreviewLocked: params.cinematicPreviewLocked ?? null,
    }),

  deleteCharacter: (characterId: string) =>
    withLinkInvalidation(invoke<void>('delete_character', { characterId })),

  restoreCharacter: (characterId: string) =>
    withLinkInvalidation(invoke<CharacterFull>('restore_character', { characterId })),

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
    blockType?: BlockType;
  }) =>
    invoke<CardBlock>('create_card_block', {
      characterId: params.characterId,
      title: params.title,
      gridColumn: params.gridColumn,
      gridRow: params.gridRow,
      colSpan: params.colSpan ?? null,
      rowSpan: params.rowSpan ?? null,
      blockType: params.blockType ?? null,
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
    withLinkInvalidation(invoke<void>('delete_lore_document', { documentId })),

  restoreLoreDocument: (documentId: string) =>
    withLinkInvalidation(invoke<LoreDocumentFull>('restore_lore_document', { documentId })),

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

  resolveInlineLinks: (refs: InlineLinkRef[]) =>
    invoke<InlineLinkResolution[]>('resolve_inline_links', { refs }),

  // ─── Atlas Canvas (Stage 5) ────────────────────────────────────────────────

  listMapEntities: () =>
    invoke<MapEntityFull[]>('list_map_entities'),

  getMapEntity: (entityId: string) =>
    invoke<MapEntityFull>('get_map_entity', { entityId }),

  createMapEntity: (params: {
    entityType: MapEntityType;
    title: string;
    x: number;
    y: number;
    parentMapEntityId?: string;
    description?: string;
    tagsText?: string;
    imageAssetId?: string;
  }) =>
    invoke<MapEntityFull>('create_map_entity', {
      entityType: params.entityType,
      title: params.title,
      x: params.x,
      y: params.y,
      parentMapEntityId: params.parentMapEntityId ?? null,
      description: params.description ?? null,
      tagsText: params.tagsText ?? null,
      imageAssetId: params.imageAssetId ?? null,
    }),

  updateMapEntity: (params: {
    entityId: string;
    title?: string;
    entityType?: MapEntityType;
    description?: string;
    parentMapEntityId?: string;
    clearParent?: boolean;
    x?: number;
    y?: number;
    tagsText?: string;
    imageAssetId?: string;
    clearImage?: boolean;
  }) =>
    invoke<MapEntityFull>('update_map_entity', {
      entityId: params.entityId,
      title: params.title ?? null,
      entityType: params.entityType ?? null,
      description: params.description ?? null,
      parentMapEntityId: params.parentMapEntityId ?? null,
      clearParent: params.clearParent ?? null,
      x: params.x ?? null,
      y: params.y ?? null,
      tagsText: params.tagsText ?? null,
      imageAssetId: params.imageAssetId ?? null,
      clearImage: params.clearImage ?? null,
    }),

  updateMapEntityPosition: (entityId: string, x: number, y: number) =>
    invoke<void>('update_map_entity_position', { entityId, x, y }),

  deleteMapEntity: (entityId: string) =>
    withLinkInvalidation(invoke<void>('delete_map_entity', { entityId })),

  restoreMapEntity: (entityId: string) =>
    withLinkInvalidation(invoke<MapEntityFull>('restore_map_entity', { entityId })),

  getPaintLayer: () =>
    invoke<PaintLayerData>('get_paint_layer'),

  savePaintLayer: (pngBytes: Uint8Array) =>
    invoke<void>('save_paint_layer', { pngBase64: uint8ToBase64(pngBytes) }),

  clearPaintLayer: () =>
    invoke<void>('clear_paint_layer'),

  getAtlasBaseMap: () =>
    invoke<string | null>('get_atlas_base_map'),

  setAtlasBaseMap: (assetId: string) =>
    invoke<void>('set_atlas_base_map', { assetId }),

  clearAtlasBaseMap: () =>
    invoke<void>('clear_atlas_base_map'),

  // ─── Search ──────────────────────────────────────────────────────────────
  searchWorld: (query: string) =>
    invoke<SearchResult[]>('search_world', { query }),

  // ─── Recycle Bin ─────────────────────────────────────────────────────────
  listDeletedCharacters: () =>
    invoke<DeletedCharacter[]>('list_deleted_characters'),
  listDeletedMapEntities: () =>
    invoke<DeletedMapEntity[]>('list_deleted_map_entities'),
  listDeletedLoreDocuments: () =>
    invoke<DeletedLoreDocument[]>('list_deleted_lore_documents'),
  listDeletedLoreFolders: () =>
    invoke<DeletedLoreFolder[]>('list_deleted_lore_folders'),

  restoreLoreFolder: (folderId: string) =>
    invoke<LoreFolder>('restore_lore_folder', { folderId }),

  purgeCharacter: (characterId: string) =>
    withLinkInvalidation(invoke<void>('purge_character', { characterId })),
  purgeMapEntity: (entityId: string) =>
    withLinkInvalidation(invoke<void>('purge_map_entity', { entityId })),
  purgeLoreDocument: (documentId: string) =>
    withLinkInvalidation(invoke<void>('purge_lore_document', { documentId })),
  purgeLoreFolder: (folderId: string) =>
    invoke<void>('purge_lore_folder', { folderId }),
};
