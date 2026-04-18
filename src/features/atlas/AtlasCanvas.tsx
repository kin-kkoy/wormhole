import { useCallback, useEffect, useRef, useState } from 'react';
import { commands } from '../../lib/commands';
import type { MapEntityFull } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { OceanBackdrop } from './OceanBackdrop';
import { BaseMapLayer } from './BaseMapLayer';
import { PaintLayer } from './PaintLayer';
import { EntityMarker } from './EntityMarker';
import { PlacementGhost } from './PlacementGhost';
import { AtlasToolbar } from './AtlasToolbar';
import { NewEntityDialog } from './NewEntityDialog';
import type { NewEntityDraft } from './NewEntityDialog';
import { AtlasEntityPanel } from './AtlasEntityPanel';
import { useAtlasZoom } from './useAtlasZoom';
import { useAtlasPaint } from './useAtlasPaint';
import type { PaintMode } from './useAtlasPaint';
import type { ZoomTransform } from './coords';
import {
  CANVAS_SIZE,
  clientToCanvas,
  identityTransform,
} from './coords';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import './AtlasCanvas.css';

const TYPE_ICONS: Record<string, string> = {
  region: '◈',
  settlement: '⌂',
  landmark: '✦',
  district: '▣',
  infrastructure: '⚙',
};

const ACCENT_ATLAS = '#4a9eff';

export function AtlasCanvas() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<ZoomTransform>(identityTransform());
  const paintModeRef = useRef<PaintMode>(null);
  const brushColorRef = useRef<string>('#d4a574');
  const brushSizeRef = useRef<number>(40);

  const {
    atlasTool,
    atlasBrushColor,
    atlasBrushSize,
    selectedMapEntityId,
    setSelectedMapEntityId,
    setAtlasTool,
  } = useAppStore();

  const [entities, setEntities] = useState<MapEntityFull[]>([]);
  const [baseMapAssetId, setBaseMapAssetId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<NewEntityDraft | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [placedConfirming, setPlacedConfirming] = useState(false);
  const [confirmingClearPaint, setConfirmingClearPaint] = useState(false);
  const dragState = useRef<
    | {
        entityId: string | null; // null = placement ghost
        pointerId: number;
        originX: number;
        originY: number;
        startCanvasX: number;
        startCanvasY: number;
        currentX: number;
        currentY: number;
        moved: boolean;
      }
    | null
  >(null);
  const justDraggedRef = useRef(false);
  // Set when a marker was clicked (in pointerdown); checked in the outer
  // canvas click handler to prevent the just-selected marker from being
  // immediately deselected by the trailing click event.
  const justSelectedRef = useRef(false);

  // Keep refs in sync with store state for paint hook
  useEffect(() => {
    paintModeRef.current =
      atlasTool === 'brush' ? 'brush' : atlasTool === 'erase' ? 'erase' : null;
  }, [atlasTool]);
  useEffect(() => {
    brushColorRef.current = atlasBrushColor;
  }, [atlasBrushColor]);
  useEffect(() => {
    brushSizeRef.current = atlasBrushSize;
  }, [atlasBrushSize]);

  const shouldSkipZoom = useCallback(() => {
    return atlasTool === 'brush' || atlasTool === 'erase';
  }, [atlasTool]);

  const allowLeftClickPan = useCallback(() => {
    return atlasTool === 'pan';
  }, [atlasTool]);

  const handleTransform = useCallback((t: ZoomTransform) => {
    transformRef.current = t;
  }, []);

  useAtlasZoom({
    outerRef,
    innerRef,
    onTransformChange: handleTransform,
    shouldSkip: shouldSkipZoom,
    allowLeftClickPan,
  });

  const { clearAll } = useAtlasPaint({
    canvasRef: paintCanvasRef,
    outerRef,
    transformRef,
    modeRef: paintModeRef,
    colorRef: brushColorRef,
    sizeRef: brushSizeRef,
  });

  // Initial load: entities + base map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ents, baseMap] = await Promise.all([
          commands.listMapEntities(),
          commands.getAtlasBaseMap(),
        ]);
        if (cancelled) return;
        setEntities(ents);
        setBaseMapAssetId(baseMap);
      } catch (err) {
        console.error('Failed to load atlas data:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ESC cancels placement
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape' && pendingDraft) {
        setPendingDraft(null);
        setGhostPos(null);
        setPlacedConfirming(false);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pendingDraft]);

  // Canvas click handler — placement OR empty-canvas deselect
  function handleCanvasClick(e: React.MouseEvent) {
    // Snapshot and clear the transient flags atomically so they cannot
    // outlive this click cycle and interfere with a later one.
    const wasDragged = justDraggedRef.current;
    const wasSelected = justSelectedRef.current;
    justDraggedRef.current = false;
    justSelectedRef.current = false;

    if (dragState.current) return; // drag in progress
    if (wasDragged) return;
    if (wasSelected) return;
    const outer = outerRef.current;
    if (!outer) return;
    const target = e.target as Element;
    // Don't deselect if click was on a marker or other interactive element
    if (target.closest('[data-entity-drag]') || target.closest('[data-no-pan]')) {
      return;
    }
    // Skip click handling while painting
    if (atlasTool === 'brush' || atlasTool === 'erase') return;

    const rect = outer.getBoundingClientRect();
    const pt = clientToCanvas(e.clientX, e.clientY, rect, transformRef.current);

    // Placement mode: first click places the ghost
    if (pendingDraft && !placedConfirming) {
      if (pt.x < 0 || pt.y < 0 || pt.x > CANVAS_SIZE || pt.y > CANVAS_SIZE) return;
      setGhostPos({ x: pt.x, y: pt.y });
      setPlacedConfirming(true);
      return;
    }

    // Empty click deselects
    if (selectedMapEntityId) {
      setSelectedMapEntityId(null);
    }
  }

  // Confirm new entity
  async function handleConfirmPlacement() {
    if (!pendingDraft || !ghostPos) return;
    try {
      const created = await commands.createMapEntity({
        entityType: pendingDraft.entityType,
        title: pendingDraft.title,
        x: ghostPos.x,
        y: ghostPos.y,
        parentMapEntityId: pendingDraft.parentMapEntityId ?? undefined,
        description: pendingDraft.description,
        tagsText: pendingDraft.tagsText,
        imageAssetId: pendingDraft.imageAssetId ?? undefined,
      });
      setEntities((prev) => [...prev, created]);
      setSelectedMapEntityId(created.id);
      setPendingDraft(null);
      setGhostPos(null);
      setPlacedConfirming(false);
    } catch (err) {
      console.error('Failed to create entity:', err);
      alert(typeof err === 'string' ? err : 'Failed to create entity');
    }
  }

  function handleCancelPlacement() {
    setPendingDraft(null);
    setGhostPos(null);
    setPlacedConfirming(false);
  }

  // Drag handler for existing entities
  function handleEntityPointerDown(entity: MapEntityFull, e: React.PointerEvent) {
    if (atlasTool === 'brush' || atlasTool === 'erase') return;
    const outer = outerRef.current;
    if (!outer) return;
    outer.setPointerCapture(e.pointerId);
    dragState.current = {
      entityId: entity.id,
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      startCanvasX: entity.x,
      startCanvasY: entity.y,
      currentX: entity.x,
      currentY: entity.y,
      moved: false,
    };
  }

  function handleGhostPointerDown(e: React.PointerEvent) {
    if (!ghostPos) return;
    const outer = outerRef.current;
    if (!outer) return;
    outer.setPointerCapture(e.pointerId);
    dragState.current = {
      entityId: null,
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      startCanvasX: ghostPos.x,
      startCanvasY: ghostPos.y,
      currentX: ghostPos.x,
      currentY: ghostPos.y,
      moved: false,
    };
  }

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    function onPointerMove(e: PointerEvent) {
      const drag = dragState.current;
      if (!drag) return;
      if (e.pointerId !== drag.pointerId) return;
      const k = transformRef.current.k || 1;
      const dx = (e.clientX - drag.originX) / k;
      const dy = (e.clientY - drag.originY) / k;
      if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true;
      const newX = Math.min(CANVAS_SIZE, Math.max(0, drag.startCanvasX + dx));
      const newY = Math.min(CANVAS_SIZE, Math.max(0, drag.startCanvasY + dy));
      drag.currentX = newX;
      drag.currentY = newY;
      if (drag.entityId == null) {
        setGhostPos({ x: newX, y: newY });
      } else {
        const id = drag.entityId;
        setEntities((prev) =>
          prev.map((ent) => (ent.id === id ? { ...ent, x: newX, y: newY } : ent)),
        );
      }
    }

    function onPointerUp(e: PointerEvent) {
      const drag = dragState.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      try {
        outer?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (drag.entityId && drag.moved) {
        // Persist the drag end position using the drag's own tracked
        // coordinates (authoritative; not state-ref-lagged).
        const id = drag.entityId;
        commands
          .updateMapEntityPosition(id, drag.currentX, drag.currentY)
          .catch((err) => console.error('Failed to save position:', err));
      } else if (drag.entityId && !drag.moved) {
        // Click (no drag) on a marker — NOW is when we open the panel.
        // Doing it here instead of on pointerdown prevents the panel from
        // popping up every time the user tries to drag an entity.
        justSelectedRef.current = true;
        window.setTimeout(() => {
          justSelectedRef.current = false;
        }, 150);
        setSelectedMapEntityId(drag.entityId);
      }
      if (drag.moved) {
        // Block the trailing click event so we don't deselect or re-place.
        // Auto-clear so the flag never outlives its single click cycle.
        justDraggedRef.current = true;
        window.setTimeout(() => {
          justDraggedRef.current = false;
        }, 150);
      }
      dragState.current = null;
    }

    outer.addEventListener('pointermove', onPointerMove);
    outer.addEventListener('pointerup', onPointerUp);
    outer.addEventListener('pointercancel', onPointerUp);
    return () => {
      outer.removeEventListener('pointermove', onPointerMove);
      outer.removeEventListener('pointerup', onPointerUp);
      outer.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  function handleOpenNewDialog() {
    setShowNewDialog(true);
  }

  function handleDialogPlace(draft: NewEntityDraft) {
    setShowNewDialog(false);
    setPendingDraft(draft);
    setAtlasTool('select');
    // Close any open entity panel so the Escape handlers don't collide
    // with the placement-mode cancellation handler.
    setSelectedMapEntityId(null);
    // Do NOT pre-place the ghost — the user clicks on the canvas to place it.
    setGhostPos(null);
    setPlacedConfirming(false);
  }

  function handleUpdated(updated: MapEntityFull) {
    setEntities((prev) => prev.map((ent) => (ent.id === updated.id ? updated : ent)));
  }

  function handleDeleted(entityId: string) {
    // Also remove any descendants that were cascade-deleted
    const toRemove = new Set<string>([entityId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of entities) {
        if (
          e.parent_map_entity_id &&
          toRemove.has(e.parent_map_entity_id) &&
          !toRemove.has(e.id)
        ) {
          toRemove.add(e.id);
          changed = true;
        }
      }
    }
    setEntities((prev) => prev.filter((ent) => !toRemove.has(ent.id)));
    setSelectedMapEntityId(null);
  }

  function handleClearPaint() {
    setConfirmingClearPaint(true);
  }

  function handleConfirmClearPaint() {
    setConfirmingClearPaint(false);
    clearAll();
  }

  const selected = entities.find((e) => e.id === selectedMapEntityId) ?? null;
  const paintInteractive = atlasTool === 'brush' || atlasTool === 'erase';
  const placementActive = !!pendingDraft && placedConfirming;

  const cursorStyle =
    atlasTool === 'brush' || atlasTool === 'erase'
      ? 'crosshair'
      : atlasTool === 'pan'
        ? 'grab'
        : pendingDraft && !placedConfirming
          ? 'crosshair'
          : 'default';

  return (
    <div className="atlas-canvas-root">
      <AtlasToolbar
        baseMapAssetId={baseMapAssetId}
        onBaseMapChanged={setBaseMapAssetId}
        onAddEntity={handleOpenNewDialog}
        onClearPaint={handleClearPaint}
        pendingPlacement={!!pendingDraft}
      />

      <div
        ref={outerRef}
        className="atlas-canvas"
        style={{ cursor: cursorStyle }}
        onClick={handleCanvasClick}
      >
        {/*
          Ocean is OUTSIDE the transformed world so we only paint a small
          viewport-sized element (not 10000×10000). Paint strokes and the
          base-map image inside the world are transparent where unpainted,
          so the ocean shows through naturally.
        */}
        <OceanBackdrop />
        <div ref={innerRef} className="atlas-canvas__world">
          <BaseMapLayer assetId={baseMapAssetId} />
          <PaintLayer ref={paintCanvasRef} interactive={paintInteractive} />
          <div
            className="atlas-canvas__entities"
            style={{ pointerEvents: paintInteractive ? 'none' : 'auto' }}
          >
            {entities.map((entity) => (
              <EntityMarker
                key={entity.id}
                entity={entity}
                selected={entity.id === selectedMapEntityId}
                onPointerDown={(e) => handleEntityPointerDown(entity, e)}
                accentColor={ACCENT_ATLAS}
              />
            ))}
            {placementActive && ghostPos && pendingDraft && (
              <PlacementGhost
                x={ghostPos.x}
                y={ghostPos.y}
                label={pendingDraft.title}
                icon={TYPE_ICONS[pendingDraft.entityType] ?? '◈'}
                accentColor={ACCENT_ATLAS}
                onConfirm={handleConfirmPlacement}
                onCancel={handleCancelPlacement}
                onPointerDown={handleGhostPointerDown}
              />
            )}
          </div>
        </div>

        {pendingDraft && !placedConfirming && (
          <div className="atlas-canvas__placement-hint" data-no-pan>
            Click on the map to place <strong>{pendingDraft.title}</strong>
            <button
              className="btn btn--ghost btn--tiny"
              onClick={handleCancelPlacement}
              style={{ marginLeft: 12 }}
            >
              Cancel
            </button>
          </div>
        )}

        {entities.length === 0 && !pendingDraft && (
          <div className="atlas-canvas__empty" data-no-pan>
            <p>No map entities yet.</p>
            <button className="btn btn--primary" onClick={handleOpenNewDialog}>
              Create your first entity
            </button>
          </div>
        )}
      </div>

      {selected && (
        <AtlasEntityPanel
          entity={selected}
          allEntities={entities}
          onClose={() => setSelectedMapEntityId(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}

      {showNewDialog && (
        <NewEntityDialog
          existingEntities={entities}
          onPlace={handleDialogPlace}
          onCancel={() => setShowNewDialog(false)}
        />
      )}

      {confirmingClearPaint && (
        <ConfirmDialog
          title="Clear painted regions?"
          message="All painted regions will be removed from the canvas. This cannot be undone."
          confirmLabel="Clear"
          confirmDanger
          onConfirm={handleConfirmClearPaint}
          onCancel={() => setConfirmingClearPaint(false)}
        />
      )}
    </div>
  );
}
