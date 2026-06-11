import { useCallback, useEffect, useMemo, useState } from 'react';
import { commands, type CharactersGraphData } from '../../../lib/commands';
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

interface CharactersGraphProps {
  searchQuery: string;
}

export function CharactersGraph({ searchQuery }: CharactersGraphProps) {
  const editMode = useAppStore((s) => s.editMode);
  const [data, setData] = useState<CharactersGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<{ x: number; y: number; name: string; count?: number; subtitle?: string } | null>(null);
  const [linkModeTarget, setLinkModeTarget] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const { getImageUrl, loadImages } = useImageCache();

  async function refreshData() {
    try {
      const graphData = await commands.getCharactersGraphData();
      setData(graphData);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await commands.autoDetectSharedNodes('characters');
        await refreshData();
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    const ids = data.characters.map((c) => c.image_asset_id).filter((id): id is string => id != null);
    if (ids.length > 0) loadImages(ids);
  }, [data, loadImages]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Build tree (pure computation)
  const { roots, hierarchyLinks, parentChildMap } = useMemo(() => {
    if (!data) return { roots: [] as LayoutNode[], hierarchyLinks: [] as [string, string][], parentChildMap: new Map<string, string[]>() };

    const hLinks: [string, string][] = [];
    const roots: LayoutNode[] = [];
    const pcMap = new Map<string, string[]>();
    const charInGroup = new Set<string>();
    const visibleSharedNodes = data.shared_nodes.filter((sn) => !sn.hidden);

    for (const sn of visibleSharedNodes) {
      const memberChildren: LayoutNode[] = [];
      const childIds: string[] = [];
      for (const mid of sn.member_ids) {
        if (data.characters.some((c) => c.id === mid)) {
          memberChildren.push({ id: mid, children: [], collapsed: false, isGroup: false });
          hLinks.push([`shared-${sn.id}`, mid]);
          charInGroup.add(mid);
          childIds.push(mid);
        }
      }
      pcMap.set(`shared-${sn.id}`, childIds);
      roots.push({ id: `shared-${sn.id}`, children: memberChildren, collapsed: collapsed[`shared-${sn.id}`] ?? false, isGroup: true });
    }

    for (const c of data.characters) {
      if (!charInGroup.has(c.id)) roots.push({ id: c.id, children: [], collapsed: false, isGroup: false });
    }

    return { roots, hierarchyLinks: hLinks, parentChildMap: pcMap };
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
    const matching = new Set(data.characters.filter((c) => c.name.toLowerCase().includes(q)).map((c) => c.id));
    return new Set(data.characters.filter((c) => !matching.has(c.id)).map((c) => c.id));
  }, [searchQuery, data]);

  // Escape exits link mode
  useEffect(() => {
    if (!linkModeTarget) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setLinkModeTarget(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [linkModeTarget]);

  async function handleNodeClickInLinkMode(characterId: string) {
    if (!linkModeTarget) return;
    try {
      await commands.addSharedNodeMember(linkModeTarget, 'character', characterId);
    } catch {
      await commands.removeSharedNodeMember(linkModeTarget, characterId).catch(console.error);
    }
    await refreshData();
  }

  if (error) return <div className="graph-loading" style={{ color: 'var(--danger)' }}>Failed to load character data.</div>;
  if (!data) return <div className="graph-loading">Loading character data...</div>;
  if (data.characters.length === 0) return <div className="graph-loading">No characters yet. Create them in the Character Codex tab.</div>;

  const visibleSharedNodes = data.shared_nodes.filter((sn) => !sn.hidden);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <GraphCanvas ref={gRef}>
          {hierarchyLinks.map(([pid, cid]) => { const p1 = positions.get(pid), p2 = positions.get(cid); if (!p1 || !p2) return null; return <GraphLink key={`h-${pid}-${cid}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} type="hierarchy" dimmed={dimmedIds.has(cid)} />; })}

          {visibleSharedNodes.map((sn) => { const pos = positions.get(`shared-${sn.id}`); if (!pos) return null; return (
            <g key={`shared-${sn.id}`} data-draggable onPointerDown={(e) => startDrag(e, `shared-${sn.id}`)} style={{ cursor: 'grab' }}>
              <SharedNode x={pos.x} y={pos.y} size={70} name={sn.name} color={sn.color} fontStyle={sn.font_style} fontSize={sn.font_size} dimmed={false} collapsed={collapsed[`shared-${sn.id}`] ?? false} memberCount={sn.member_ids.length} onClick={() => toggleCollapse(`shared-${sn.id}`)} onHoverStart={(e) => setHover({ x: e.clientX, y: e.clientY, name: sn.name, count: sn.member_ids.length })} onHoverEnd={() => setHover(null)} />
            </g>); })}

          {data.characters.map((char) => { const pos = positions.get(char.id); if (!pos) return null; return (
            <g key={char.id} data-draggable onPointerDown={(e) => { if (!linkModeTarget) startDrag(e, char.id); }} style={{ cursor: linkModeTarget ? 'crosshair' : 'grab' }}>
              <ImageNode x={pos.x} y={pos.y} radius={28} imageUrl={getImageUrl(char.image_asset_id)} fallbackType="character" accentColor="var(--accent-characters)" dimmed={dimmedIds.has(char.id)} onClick={linkModeTarget ? () => handleNodeClickInLinkMode(char.id) : undefined} onHoverStart={(e) => setHover({ x: e.clientX, y: e.clientY, name: char.name })} onHoverEnd={() => setHover(null)} />
            </g>); })}
        </GraphCanvas>
        {hover && <HoverLabel x={hover.x} y={hover.y} name={hover.name} count={hover.count} subtitle={hover.subtitle} />}
        {linkModeTarget && (
          <div className="graph-link-mode-bar">Click characters to link/unlink. Hold Space + click to expand collapsed nodes.<button className="btn btn--ghost" onClick={() => setLinkModeTarget(null)}>Done</button></div>
        )}
      </div>
      {editMode && (
        <EditDockPanel
          graphType="characters"
          sharedNodes={data.shared_nodes}
          onSharedNodesChanged={refreshData}
          onStartLinkMode={setLinkModeTarget}
        />
      )}
    </div>
  );
}
