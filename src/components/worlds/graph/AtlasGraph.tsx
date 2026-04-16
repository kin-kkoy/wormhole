import { useCallback, useEffect, useMemo, useState } from 'react';
import { commands, type AtlasGraphData } from '../../../lib/commands';
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

interface AtlasGraphProps {
  searchQuery: string;
}

export function AtlasGraph({ searchQuery }: AtlasGraphProps) {
  const editMode = useAppStore((s) => s.editMode);
  const [data, setData] = useState<AtlasGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<{ x: number; y: number; name: string; count?: number; subtitle?: string } | null>(null);
  const [linkModeTarget, setLinkModeTarget] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const { getImageUrl, loadImages } = useImageCache();

  async function refreshData() {
    try {
      const refreshed = await commands.getAtlasGraphData();
      setData(refreshed);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await commands.autoDetectSharedNodes('atlas');
        await refreshData();
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    const ids = data.entities.map((e) => e.image_asset_id).filter((id): id is string => id != null);
    if (ids.length > 0) loadImages(ids);
  }, [data, loadImages]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Build tree (pure computation)
  const { roots, hierarchyLinks, crossLinks, parentChildMap } = useMemo(() => {
    if (!data) return { roots: [] as LayoutNode[], hierarchyLinks: [] as [string, string][], crossLinks: [] as [string, string][], parentChildMap: new Map<string, string[]>() };

    const childrenOf = new Map<string | null, string[]>();
    for (const e of data.entities) {
      const parent = e.parent_map_entity_id ?? null;
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent)!.push(e.id);
    }

    const hLinks: [string, string][] = [];
    const pcMap = new Map<string, string[]>();
    const entityMap = new Map(data.entities.map((e) => [e.id, e]));

    function buildEntityNode(entityId: string): LayoutNode {
      const children: LayoutNode[] = [];
      const childIds: string[] = [];
      for (const childId of childrenOf.get(entityId) ?? []) {
        children.push(buildEntityNode(childId));
        hLinks.push([entityId, childId]);
        childIds.push(childId);
      }
      pcMap.set(entityId, childIds);
      return { id: entityId, children, collapsed: collapsed[entityId] ?? false, isGroup: false };
    }

    const roots: LayoutNode[] = [];
    const memberToShared = new Map<string, string>();
    const visibleSharedNodes = data.shared_nodes.filter((sn) => !sn.hidden);

    for (const sn of visibleSharedNodes) {
      const memberChildren: LayoutNode[] = [];
      const childIds: string[] = [];
      for (const mid of sn.member_ids) {
        if (entityMap.has(mid)) {
          memberChildren.push(buildEntityNode(mid));
          hLinks.push([`shared-${sn.id}`, mid]);
          memberToShared.set(mid, sn.id);
          childIds.push(mid);
        }
      }
      pcMap.set(`shared-${sn.id}`, childIds);
      roots.push({ id: `shared-${sn.id}`, children: memberChildren, collapsed: collapsed[`shared-${sn.id}`] ?? false, isGroup: true });
    }

    for (const entityId of childrenOf.get(null) ?? []) {
      if (!memberToShared.has(entityId)) roots.push(buildEntityNode(entityId));
    }

    const cLinks: [string, string][] = data.links.map((l) => [l.source_id, l.target_id]);
    return { roots, hierarchyLinks: hLinks, crossLinks: cLinks, parentChildMap: pcMap };
  }, [data, collapsed]);

  // Layout in effect
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

  const dimmedIds = useMemo(() => {
    if (!searchQuery || !data) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const matching = new Set(data.entities.filter((e) => e.title.toLowerCase().includes(q)).map((e) => e.id));
    return new Set(data.entities.filter((e) => !matching.has(e.id)).map((e) => e.id));
  }, [searchQuery, data]);

  // Escape exits link mode
  useEffect(() => {
    if (!linkModeTarget) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setLinkModeTarget(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [linkModeTarget]);

  async function handleNodeClickInLinkMode(entityId: string) {
    if (!linkModeTarget) return;
    try {
      await commands.addSharedNodeMember(linkModeTarget, 'map_entity', entityId);
    } catch {
      await commands.removeSharedNodeMember(linkModeTarget, entityId).catch(console.error);
    }
    await refreshData();
  }

  if (error) return <div className="graph-loading" style={{ color: 'var(--danger)' }}>Failed to load atlas data.</div>;
  if (!data) return <div className="graph-loading">Loading atlas data...</div>;
  if (data.entities.length === 0) return <div className="graph-loading">No map entities yet. Create them in the Atlas Canvas tab.</div>;

  const visibleSharedNodes = data.shared_nodes.filter((sn) => !sn.hidden);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <GraphCanvas ref={gRef}>
          {hierarchyLinks.map(([pid, cid]) => { const p1 = positions.get(pid), p2 = positions.get(cid); if (!p1 || !p2) return null; return <GraphLink key={`h-${pid}-${cid}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} type="hierarchy" dimmed={dimmedIds.has(pid) && dimmedIds.has(cid)} />; })}
          {crossLinks.map(([sid, tid]) => { const p1 = positions.get(sid), p2 = positions.get(tid); if (!p1 || !p2) return null; return <GraphLink key={`c-${sid}-${tid}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} type="crosslink" dimmed={dimmedIds.has(sid) && dimmedIds.has(tid)} />; })}

          {visibleSharedNodes.map((sn) => { const pos = positions.get(`shared-${sn.id}`); if (!pos) return null; return (
            <g key={`shared-${sn.id}`} data-draggable onPointerDown={(e) => startDrag(e, `shared-${sn.id}`)} style={{ cursor: 'grab' }}>
              <SharedNode x={pos.x} y={pos.y} size={70} name={sn.name} color={sn.color} fontStyle={sn.font_style} fontSize={sn.font_size} dimmed={false} collapsed={collapsed[`shared-${sn.id}`] ?? false} memberCount={sn.member_ids.length} onClick={() => toggleCollapse(`shared-${sn.id}`)} onHoverStart={(e) => setHover({ x: e.clientX, y: e.clientY, name: sn.name, count: sn.member_ids.length })} onHoverEnd={() => setHover(null)} />
            </g>); })}

          {data.entities.map((entity) => { const pos = positions.get(entity.id); if (!pos) return null; return (
            <g key={entity.id} data-draggable onPointerDown={(e) => { if (!linkModeTarget) startDrag(e, entity.id); }} style={{ cursor: linkModeTarget ? 'crosshair' : 'grab' }}>
              <ImageNode x={pos.x} y={pos.y} radius={28} imageUrl={getImageUrl(entity.image_asset_id)} fallbackType="map" dimmed={dimmedIds.has(entity.id)} onClick={linkModeTarget ? () => handleNodeClickInLinkMode(entity.id) : undefined} onHoverStart={(e) => setHover({ x: e.clientX, y: e.clientY, name: entity.title, subtitle: entity.entity_type })} onHoverEnd={() => setHover(null)} />
            </g>); })}
        </GraphCanvas>
        {hover && <HoverLabel x={hover.x} y={hover.y} name={hover.name} count={hover.count} subtitle={hover.subtitle} />}
        {linkModeTarget && (
          <div className="graph-link-mode-bar">Click entities to link/unlink. Press Escape or Done to exit.<button className="btn btn--ghost" onClick={() => setLinkModeTarget(null)}>Done</button></div>
        )}
      </div>
      {editMode && (
        <EditDockPanel graphType="atlas" sharedNodes={data.shared_nodes} onSharedNodesChanged={refreshData} onStartLinkMode={setLinkModeTarget} />
      )}
    </div>
  );
}
