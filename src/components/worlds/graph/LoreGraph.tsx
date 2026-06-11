import { useCallback, useEffect, useMemo, useState } from 'react';
import { commands, type LoreGraphData } from '../../../lib/commands';
import { computeRadialLayout, type LayoutNode } from '../../../lib/graph-layout';
import { useGraphDrag } from '../../../hooks/useGraphDrag';
import { GraphCanvas } from './GraphCanvas';
import { ImageNode } from './ImageNode';
import { SharedNode } from './SharedNode';
import { GraphLink } from './GraphLink';
import { HoverLabel } from './HoverLabel';

interface LoreGraphProps {
  searchQuery: string;
}

export function LoreGraph({ searchQuery }: LoreGraphProps) {
  const [data, setData] = useState<LoreGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<{ x: number; y: number; name: string; count?: number } | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    commands.getLoreGraphData()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Build tree structure + parent-child map (pure computation, no side effects)
  const { roots, linkPairs, parentChildMap } = useMemo(() => {
    if (!data) return { roots: [] as LayoutNode[], linkPairs: [] as [string, string][], parentChildMap: new Map<string, string[]>() };

    const childFolders = new Map<string | null, typeof data.folders>();
    const childDocs = new Map<string | null, typeof data.documents>();

    for (const f of data.folders) {
      const parent = f.parent_folder_id ?? null;
      if (!childFolders.has(parent)) childFolders.set(parent, []);
      childFolders.get(parent)!.push(f);
    }
    for (const d of data.documents) {
      const folder = d.folder_id ?? null;
      if (!childDocs.has(folder)) childDocs.set(folder, []);
      childDocs.get(folder)!.push(d);
    }

    const pairs: [string, string][] = [];
    const pcMap = new Map<string, string[]>();

    function buildFolderNode(folderId: string): LayoutNode {
      const children: LayoutNode[] = [];
      const childIds: string[] = [];
      for (const sf of childFolders.get(folderId) ?? []) {
        children.push(buildFolderNode(sf.id));
        pairs.push([folderId, sf.id]);
        childIds.push(sf.id);
      }
      for (const doc of childDocs.get(folderId) ?? []) {
        children.push({ id: doc.id, children: [], collapsed: false, isGroup: false });
        pairs.push([folderId, doc.id]);
        childIds.push(doc.id);
      }
      pcMap.set(folderId, childIds);
      return { id: folderId, children, collapsed: collapsed[folderId] ?? false, isGroup: true };
    }

    const roots: LayoutNode[] = [];
    for (const f of childFolders.get(null) ?? []) roots.push(buildFolderNode(f.id));
    for (const d of childDocs.get(null) ?? []) roots.push({ id: d.id, children: [], collapsed: false, isGroup: false });

    return { roots, linkPairs: pairs, parentChildMap: pcMap };
  }, [data, collapsed]);

  // Compute layout in effect (not during render)
  useEffect(() => {
    if (roots.length === 0) return;
    setPositions(computeRadialLayout(roots));
  }, [roots]);

  const getDescendants = useCallback((nodeId: string): string[] => {
    const result = [nodeId];
    for (const cid of parentChildMap.get(nodeId) ?? []) {
      result.push(...getDescendants(cid));
    }
    return result;
  }, [parentChildMap]);

  const { gRef, startDrag } = useGraphDrag(positions, setPositions, getDescendants);

  // Search dimming
  const dimmedIds = useMemo(() => {
    if (!searchQuery || !data) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const allIds = new Set<string>();
    for (const f of data.folders) allIds.add(f.id);
    for (const d of data.documents) allIds.add(d.id);
    const matching = new Set<string>();
    for (const f of data.folders) if (f.title.toLowerCase().includes(q)) matching.add(f.id);
    for (const d of data.documents) if (d.title.toLowerCase().includes(q)) matching.add(d.id);
    const dimmed = new Set<string>();
    for (const id of allIds) if (!matching.has(id)) dimmed.add(id);
    return dimmed;
  }, [searchQuery, data]);

  if (error) {
    return <div className="graph-loading" style={{ color: 'var(--danger)' }}>Failed to load lore data.</div>;
  }
  if (!data) {
    return <div className="graph-loading">Loading lore data...</div>;
  }
  if (data.folders.length === 0 && data.documents.length === 0) {
    return <div className="graph-loading">No lore content yet. Create folders and documents in the Lore Archive tab.</div>;
  }

  const folderDocCount = new Map<string, number>();
  for (const d of data.documents) {
    if (d.folder_id) folderDocCount.set(d.folder_id, (folderDocCount.get(d.folder_id) ?? 0) + 1);
  }

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <GraphCanvas ref={gRef}>
        {linkPairs.map(([parentId, childId]) => {
          const p1 = positions.get(parentId);
          const p2 = positions.get(childId);
          if (!p1 || !p2) return null;
          return <GraphLink key={`${parentId}-${childId}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} type="hierarchy" dimmed={dimmedIds.has(parentId) && dimmedIds.has(childId)} />;
        })}

        {data.folders.map((folder) => {
          const pos = positions.get(folder.id);
          if (!pos) return null;
          return (
            <g key={folder.id} data-draggable onPointerDown={(e) => startDrag(e, folder.id)} style={{ cursor: 'grab' }}>
              <SharedNode x={pos.x} y={pos.y} size={60} name={folder.title} color="var(--accent-lore)" fontStyle="normal" fontSize={12} dimmed={dimmedIds.has(folder.id)} collapsed={collapsed[folder.id] ?? false} memberCount={folderDocCount.get(folder.id) ?? 0} onClick={() => toggleCollapse(folder.id)} onHoverStart={(e) => setHover({ x: e.clientX, y: e.clientY, name: folder.title, count: folderDocCount.get(folder.id) ?? 0 })} onHoverEnd={() => setHover(null)} />
            </g>
          );
        })}

        {data.documents.map((doc) => {
          const pos = positions.get(doc.id);
          if (!pos) return null;
          return (
            <g key={doc.id} data-draggable onPointerDown={(e) => startDrag(e, doc.id)} style={{ cursor: 'grab' }}>
              <ImageNode x={pos.x} y={pos.y} radius={24} imageUrl={null} fallbackType="document" accentColor="var(--accent-lore)" dimmed={dimmedIds.has(doc.id)} onHoverStart={(e) => setHover({ x: e.clientX, y: e.clientY, name: doc.title })} onHoverEnd={() => setHover(null)} />
            </g>
          );
        })}
      </GraphCanvas>
      {hover && <HoverLabel x={hover.x} y={hover.y} name={hover.name} count={hover.count} />}
    </div>
  );
}
