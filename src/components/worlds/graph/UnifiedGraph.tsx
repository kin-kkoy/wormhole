import { useCallback, useEffect, useMemo, useState } from 'react';
import { commands, type CharactersGraphData, type LoreGraphData } from '../../../lib/commands';
import { computeRadialLayout, type LayoutNode } from '../../../lib/graph-layout';
import { useImageCache } from '../../../hooks/useImageCache';
import { useGraphDrag } from '../../../hooks/useGraphDrag';
import { useAppStore } from '../../../state/store';
import { GraphCanvas } from './GraphCanvas';
import { ImageNode } from './ImageNode';
import { SharedNode } from './SharedNode';
import { GraphLink } from './GraphLink';
import { HoverLabel } from './HoverLabel';
import { EditDockPanel } from './EditDockPanel';

interface UnifiedGraphProps {
  searchQuery: string;
}

export function UnifiedGraph({ searchQuery }: UnifiedGraphProps) {
  const editMode = useAppStore((s) => s.editMode);
  const setPeekTarget = useAppStore((s) => s.setPeekTarget);
  const peekTarget = useAppStore((s) => s.peekTarget);
  const [linkModeTarget, setLinkModeTarget] = useState<string | null>(null);

  const [charData, setCharData] = useState<CharactersGraphData | null>(null);
  const [loreData, setLoreData] = useState<LoreGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<{ x: number; y: number; name: string; count?: number } | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const { getImageUrl, loadImages } = useImageCache();

  useEffect(() => {
    (async () => {
      try {
        await commands.autoDetectSharedNodes('characters');
        const [chars, lore] = await Promise.all([
          commands.getCharactersGraphData(),
          commands.getLoreGraphData(),
        ]);
        setCharData(chars);
        setLoreData(lore);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!charData) return;
    const ids = charData.characters.map((c) => c.image_asset_id).filter((id): id is string => id != null);
    if (ids.length > 0) loadImages(ids);
  }, [charData, loadImages]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Build unified tree: character subtrees on the left half, lore subtrees on the right
  const { roots, hierarchyLinks, parentChildMap } = useMemo(() => {
    const hLinks: [string, string][] = [];
    const roots: LayoutNode[] = [];
    const pcMap = new Map<string, string[]>();

    // ── Characters ──
    if (charData) {
      const charInGroup = new Set<string>();
      const visibleSharedNodes = charData.shared_nodes.filter((sn) => !sn.hidden);

      for (const sn of visibleSharedNodes) {
        const memberChildren: LayoutNode[] = [];
        const childIds: string[] = [];
        for (const mid of sn.member_ids) {
          if (charData.characters.some((c) => c.id === mid)) {
            const nodeId = `char-${mid}`;
            memberChildren.push({ id: nodeId, children: [], collapsed: false, isGroup: false });
            hLinks.push([`shared-${sn.id}`, nodeId]);
            charInGroup.add(mid);
            childIds.push(nodeId);
          }
        }
        pcMap.set(`shared-${sn.id}`, childIds);
        roots.push({
          id: `shared-${sn.id}`,
          children: memberChildren,
          collapsed: collapsed[`shared-${sn.id}`] ?? false,
          isGroup: true,
        });
      }

      for (const c of charData.characters) {
        if (!charInGroup.has(c.id)) {
          roots.push({ id: `char-${c.id}`, children: [], collapsed: false, isGroup: false });
        }
      }
    }

    // ── Lore ──
    if (loreData) {
      const childFolders = new Map<string | null, typeof loreData.folders>();
      const childDocs = new Map<string | null, typeof loreData.documents>();

      for (const f of loreData.folders) {
        const parent = f.parent_folder_id ?? null;
        if (!childFolders.has(parent)) childFolders.set(parent, []);
        childFolders.get(parent)!.push(f);
      }
      for (const d of loreData.documents) {
        const folder = d.folder_id ?? null;
        if (!childDocs.has(folder)) childDocs.set(folder, []);
        childDocs.get(folder)!.push(d);
      }

      function buildFolderNode(folderId: string): LayoutNode {
        const children: LayoutNode[] = [];
        const childIds: string[] = [];
        for (const sf of childFolders.get(folderId) ?? []) {
          children.push(buildFolderNode(sf.id));
          hLinks.push([`folder-${folderId}`, `folder-${sf.id}`]);
          childIds.push(`folder-${sf.id}`);
        }
        for (const doc of childDocs.get(folderId) ?? []) {
          const nodeId = `doc-${doc.id}`;
          children.push({ id: nodeId, children: [], collapsed: false, isGroup: false });
          hLinks.push([`folder-${folderId}`, nodeId]);
          childIds.push(nodeId);
        }
        pcMap.set(`folder-${folderId}`, childIds);
        return {
          id: `folder-${folderId}`,
          children,
          collapsed: collapsed[`folder-${folderId}`] ?? false,
          isGroup: true,
        };
      }

      for (const f of childFolders.get(null) ?? []) {
        roots.push(buildFolderNode(f.id));
      }
      for (const d of childDocs.get(null) ?? []) {
        roots.push({ id: `doc-${d.id}`, children: [], collapsed: false, isGroup: false });
      }
    }

    return { roots, hierarchyLinks: hLinks, parentChildMap: pcMap };
  }, [charData, loreData, collapsed]);

  useEffect(() => {
    if (roots.length === 0) return;
    setPositions(computeRadialLayout(roots));
  }, [roots]);

  const getDescendants = useCallback((nodeId: string): string[] => {
    const result = [nodeId];
    for (const cid of parentChildMap.get(nodeId) ?? []) result.push(...getDescendants(cid));
    return result;
  }, [parentChildMap]);

  const { gRef, startDrag } = useGraphDrag(positions, setPositions, getDescendants);

  // Escape exits link mode
  useEffect(() => {
    if (!linkModeTarget) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setLinkModeTarget(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [linkModeTarget]);

  async function refreshData() {
    try {
      const [chars, lore] = await Promise.all([
        commands.getCharactersGraphData(),
        commands.getLoreGraphData(),
      ]);
      setCharData(chars);
      setLoreData(lore);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleNodeClickInLinkMode(characterId: string) {
    if (!linkModeTarget) return;
    try {
      await commands.addSharedNodeMember(linkModeTarget, 'character', characterId);
    } catch {
      await commands.removeSharedNodeMember(linkModeTarget, characterId).catch(console.error);
    }
    await refreshData();
  }

  // Search dimming — matches across both characters and lore
  const dimmedIds = useMemo(() => {
    if (!searchQuery) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const dimmed = new Set<string>();

    if (charData) {
      for (const c of charData.characters) {
        if (!c.name.toLowerCase().includes(q)) dimmed.add(`char-${c.id}`);
      }
    }
    if (loreData) {
      for (const f of loreData.folders) {
        if (!f.title.toLowerCase().includes(q)) dimmed.add(`folder-${f.id}`);
      }
      for (const d of loreData.documents) {
        if (!d.title.toLowerCase().includes(q)) dimmed.add(`doc-${d.id}`);
      }
    }
    return dimmed;
  }, [searchQuery, charData, loreData]);

  // Selected node ID for visual highlight
  const selectedNodeId = useMemo(() => {
    if (!peekTarget) return null;
    if (peekTarget.entityType === 'character') return `char-${peekTarget.entityId}`;
    if (peekTarget.entityType === 'lore_document') return `doc-${peekTarget.entityId}`;
    return null;
  }, [peekTarget]);

  if (error) return <div className="graph-loading" style={{ color: 'var(--danger)' }}>Failed to load graph data.</div>;
  if (!charData && !loreData) return <div className="graph-loading">Loading...</div>;

  const hasContent = (charData && charData.characters.length > 0) || (loreData && (loreData.folders.length > 0 || loreData.documents.length > 0));
  if (!hasContent) return <div className="graph-loading">No content yet. Create characters or lore to see your world's constellation.</div>;

  const visibleSharedNodes = charData?.shared_nodes.filter((sn) => !sn.hidden) ?? [];

  const folderDocCount = new Map<string, number>();
  if (loreData) {
    for (const d of loreData.documents) {
      if (d.folder_id) folderDocCount.set(d.folder_id, (folderDocCount.get(d.folder_id) ?? 0) + 1);
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <GraphCanvas ref={gRef}>
        {/* Links */}
        {hierarchyLinks.map(([pid, cid]) => {
          const p1 = positions.get(pid);
          const p2 = positions.get(cid);
          if (!p1 || !p2) return null;
          return (
            <GraphLink
              key={`h-${pid}-${cid}`}
              x1={p1.x} y1={p1.y}
              x2={p2.x} y2={p2.y}
              type="hierarchy"
              dimmed={dimmedIds.has(cid)}
            />
          );
        })}

        {/* Character shared nodes */}
        {visibleSharedNodes.map((sn) => {
          const pos = positions.get(`shared-${sn.id}`);
          if (!pos) return null;
          return (
            <g key={`shared-${sn.id}`} data-draggable onPointerDown={(e) => startDrag(e, `shared-${sn.id}`)} style={{ cursor: 'grab' }}>
              <SharedNode
                x={pos.x} y={pos.y} size={70}
                name={sn.name} color={sn.color}
                fontStyle={sn.font_style} fontSize={sn.font_size}
                dimmed={false}
                collapsed={collapsed[`shared-${sn.id}`] ?? false}
                memberCount={sn.member_ids.length}
                onClick={() => toggleCollapse(`shared-${sn.id}`)}
                onHoverStart={(e) => setHover({ x: e.clientX, y: e.clientY, name: sn.name, count: sn.member_ids.length })}
                onHoverEnd={() => setHover(null)}
              />
            </g>
          );
        })}

        {/* Character nodes */}
        {charData?.characters.map((char) => {
          const pos = positions.get(`char-${char.id}`);
          if (!pos) return null;
          const inLinkMode = !!linkModeTarget;
          return (
            <g key={`char-${char.id}`} data-draggable onPointerDown={(e) => { if (!inLinkMode) startDrag(e, `char-${char.id}`); }} style={{ cursor: inLinkMode ? 'crosshair' : 'grab' }}>
              <ImageNode
                x={pos.x} y={pos.y} radius={28}
                imageUrl={getImageUrl(char.image_asset_id)}
                fallbackType="character"
                accentColor="var(--accent-characters)"
                dimmed={dimmedIds.has(`char-${char.id}`)}
                selected={selectedNodeId === `char-${char.id}`}
                onClick={inLinkMode ? () => handleNodeClickInLinkMode(char.id) : () => setPeekTarget({ entityType: 'character', entityId: char.id })}
                onHoverStart={(e) => setHover({ x: e.clientX, y: e.clientY, name: char.name })}
                onHoverEnd={() => setHover(null)}
              />
            </g>
          );
        })}

        {/* Lore folder nodes */}
        {loreData?.folders.map((folder) => {
          const pos = positions.get(`folder-${folder.id}`);
          if (!pos) return null;
          return (
            <g key={`folder-${folder.id}`} data-draggable onPointerDown={(e) => startDrag(e, `folder-${folder.id}`)} style={{ cursor: 'grab' }}>
              <SharedNode
                x={pos.x} y={pos.y} size={60}
                name={folder.title} color="var(--accent-lore)"
                fontStyle="normal" fontSize={12}
                dimmed={dimmedIds.has(`folder-${folder.id}`)}
                collapsed={collapsed[`folder-${folder.id}`] ?? false}
                memberCount={folderDocCount.get(folder.id) ?? 0}
                onClick={() => toggleCollapse(`folder-${folder.id}`)}
                onHoverStart={(e) => setHover({ x: e.clientX, y: e.clientY, name: folder.title, count: folderDocCount.get(folder.id) ?? 0 })}
                onHoverEnd={() => setHover(null)}
              />
            </g>
          );
        })}

        {/* Lore document nodes */}
        {loreData?.documents.map((doc) => {
          const pos = positions.get(`doc-${doc.id}`);
          if (!pos) return null;
          return (
            <g key={`doc-${doc.id}`} data-draggable onPointerDown={(e) => startDrag(e, `doc-${doc.id}`)} style={{ cursor: 'grab' }}>
              <ImageNode
                x={pos.x} y={pos.y} radius={24}
                imageUrl={null}
                fallbackType="document"
                accentColor="var(--accent-lore)"
                dimmed={dimmedIds.has(`doc-${doc.id}`)}
                selected={selectedNodeId === `doc-${doc.id}`}
                onClick={() => setPeekTarget({ entityType: 'lore_document', entityId: doc.id })}
                onHoverStart={(e) => setHover({ x: e.clientX, y: e.clientY, name: doc.title })}
                onHoverEnd={() => setHover(null)}
              />
            </g>
          );
        })}
      </GraphCanvas>
      {hover && <HoverLabel x={hover.x} y={hover.y} name={hover.name} count={hover.count} />}
      {linkModeTarget && (
        <div className="graph-link-mode-bar">Click characters to link/unlink. Hold Space + click to expand collapsed nodes.<button className="btn btn--ghost" onClick={() => setLinkModeTarget(null)}>Done</button></div>
      )}
    </div>
    {editMode && charData && (
      <EditDockPanel
        graphType="characters"
        sharedNodes={charData.shared_nodes}
        onSharedNodesChanged={refreshData}
        onStartLinkMode={setLinkModeTarget}
      />
    )}
    </div>
  );
}
