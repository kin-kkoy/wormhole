import {
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import {
  buildMarkdownGraphModel,
  createDefaultGraphSettings,
  createGraphGroup,
} from "./markdown-graph";
import "./MarkdownGraphView.css";
import type {
  MarkdownGraphModel,
  MarkdownGraphNode,
  MarkdownGraphSettings,
  MarkdownGraphViewProps,
} from "./types";

type SimulationNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type CameraState = {
  x: number;
  y: number;
  scale: number;
};

type PointerState =
  | { mode: "idle" }
  | {
      mode: "pan";
      originX: number;
      originY: number;
      cameraX: number;
      cameraY: number;
    }
  | {
      mode: "drag-node";
      nodeId: string;
      offsetX: number;
      offsetY: number;
    };

const DEFAULT_HEIGHT = 760;

export function MarkdownGraphView({
  documents,
  selectedNodeId,
  initialSettings,
  height = DEFAULT_HEIGHT,
  className,
  style,
  onSelectNode,
  onCreateUnresolved,
}: MarkdownGraphViewProps) {
  const graphId = useId();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, scale: 1 });
  const pointerRef = useRef<PointerState>({ mode: "idle" });
  const hoveredIdRef = useRef<string | null>(null);
  const graphModelRef = useRef<MarkdownGraphModel | null>(null);
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId ?? null);
  const simulationNodesRef = useRef<Map<string, SimulationNode>>(new Map());
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [settings, setSettings] = useState<MarkdownGraphSettings>(() =>
    createDefaultGraphSettings(initialSettings),
  );
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);

  const deferredDocuments = useDeferredValue(documents);
  const graphModel = buildMarkdownGraphModel(deferredDocuments, settings);
  const effectiveSelectedNodeId = selectedNodeId ?? internalSelectedNodeId;
  const selectedNode = effectiveSelectedNodeId
    ? graphModel.nodesById.get(effectiveSelectedNodeId) ?? null
    : null;
  const selectedDocument =
    selectedNode?.sourcePath ? graphModel.documentsByPath.get(selectedNode.sourcePath) ?? null : null;
  const selectedAliases = selectedDocument?.aliases?.join(", ") || "None";

  graphModelRef.current = graphModel;
  selectedNodeIdRef.current = effectiveSelectedNodeId;

  useEffect(() => {
    if (selectedNodeId !== undefined) {
      return;
    }

    if (!effectiveSelectedNodeId && graphModel.visibleNodes[0]) {
      setInternalSelectedNodeId(graphModel.visibleNodes[0].id);
      return;
    }

    if (effectiveSelectedNodeId && !graphModel.nodesById.has(effectiveSelectedNodeId)) {
      setInternalSelectedNodeId(graphModel.visibleNodes[0]?.id ?? null);
    }
  }, [effectiveSelectedNodeId, graphModel.nodesById, graphModel.visibleNodes, selectedNodeId]);

  useEffect(() => {
    const simulationNodes = simulationNodesRef.current;
    const nextSimulationNodes = new Map<string, SimulationNode>();

    graphModel.nodes.forEach((node, index) => {
      const existing = simulationNodes.get(node.id);
      nextSimulationNodes.set(node.id, {
        id: node.id,
        x: existing?.x ?? randomPosition(index).x,
        y: existing?.y ?? randomPosition(index).y,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
      });
    });

    simulationNodesRef.current = nextSimulationNodes;
  }, [graphModel.nodes]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      sizeCanvas(canvas, stage, cameraRef.current);
    });

    resizeObserver.observe(stage);
    sizeCanvas(canvas, stage, cameraRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let frameId = 0;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const renderFrame = () => {
      const model = graphModelRef.current;
      if (model) {
        runSimulation({
          model,
          settings,
          pointer: pointerRef.current,
          simulationNodes: simulationNodesRef.current,
        });

        drawGraph({
          canvas,
          context,
          model,
          camera: cameraRef.current,
          settings,
          selectedNodeId: selectedNodeIdRef.current,
          hoveredNodeId: hoveredIdRef.current,
          simulationNodes: simulationNodesRef.current,
        });
      }

      frameId = window.requestAnimationFrame(renderFrame);
    };

    frameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [settings]);

  const filteredDocuments = graphModel.nodes
    .filter((node) => node.hasDocument)
    .filter((node) => {
      if (!sidebarQuery.trim()) {
        return true;
      }

      const query = sidebarQuery.trim().toLowerCase();
      const document = node.sourcePath ? graphModel.documentsByPath.get(node.sourcePath) : null;
      return (
        node.label.toLowerCase().includes(query) ||
        node.id.toLowerCase().includes(query) ||
        (document?.content.toLowerCase().includes(query) ?? false)
      );
    });

  function selectNode(node: MarkdownGraphNode) {
    if (selectedNodeId === undefined) {
      setInternalSelectedNodeId(node.id);
    }

    onSelectNode?.({
      node,
      document: node.sourcePath ? graphModel.documentsByPath.get(node.sourcePath) ?? null : null,
    });
  }

  function centerOnNode(nodeId: string | null) {
    if (!nodeId || !stageRef.current) {
      return;
    }

    const simulationNode = simulationNodesRef.current.get(nodeId);
    if (!simulationNode) {
      return;
    }

    const bounds = stageRef.current.getBoundingClientRect();
    cameraRef.current.x = bounds.width / 2 - simulationNode.x * cameraRef.current.scale;
    cameraRef.current.y = bounds.height / 2 - simulationNode.y * cameraRef.current.scale;
  }

  function updateSettings<K extends keyof MarkdownGraphSettings>(
    key: K,
    value: MarkdownGraphSettings[K],
  ) {
    startTransition(() => {
      setSettings((current) => ({
        ...current,
        [key]: value,
      }));
    });
  }

  function updateGroup(groupId: string, patch: Partial<MarkdownGraphSettings["groups"][number]>) {
    setSettings((current) => ({
      ...current,
      groups: current.groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    }));
  }

  function removeGroup(groupId: string) {
    setSettings((current) => ({
      ...current,
      groups: current.groups.filter((group) => group.id !== groupId),
    }));
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const model = graphModelRef.current;
    if (!canvas || !model) {
      return;
    }

    const hitNode = findNodeAtPosition({
      clientX: event.clientX,
      clientY: event.clientY,
      canvas,
      camera: cameraRef.current,
      model,
      simulationNodes: simulationNodesRef.current,
    });

    if (hitNode) {
      const bounds = canvas.getBoundingClientRect();
      const worldPoint = screenToWorld({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        camera: cameraRef.current,
      });
      const simulationNode = simulationNodesRef.current.get(hitNode.id);
      if (simulationNode) {
        pointerRef.current = {
          mode: "drag-node",
          nodeId: hitNode.id,
          offsetX: simulationNode.x - worldPoint.x,
          offsetY: simulationNode.y - worldPoint.y,
        };
      }
      selectNode(hitNode);
    } else {
      pointerRef.current = {
        mode: "pan",
        originX: event.clientX,
        originY: event.clientY,
        cameraX: cameraRef.current.x,
        cameraY: cameraRef.current.y,
      };
    }

    canvas.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const model = graphModelRef.current;
    if (!canvas || !model) {
      return;
    }

    const pointer = pointerRef.current;
    const bounds = canvas.getBoundingClientRect();

    if (pointer.mode === "drag-node") {
      const simulationNode = simulationNodesRef.current.get(pointer.nodeId);
      if (!simulationNode) {
        return;
      }

      const worldPoint = screenToWorld({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        camera: cameraRef.current,
      });
      simulationNode.x = worldPoint.x + pointer.offsetX;
      simulationNode.y = worldPoint.y + pointer.offsetY;
      simulationNode.vx = 0;
      simulationNode.vy = 0;
      return;
    }

    if (pointer.mode === "pan") {
      cameraRef.current.x = pointer.cameraX + (event.clientX - pointer.originX);
      cameraRef.current.y = pointer.cameraY + (event.clientY - pointer.originY);
      return;
    }

    const hoveredNode = findNodeAtPosition({
      clientX: event.clientX,
      clientY: event.clientY,
      canvas,
      camera: cameraRef.current,
      model,
      simulationNodes: simulationNodesRef.current,
    });
    hoveredIdRef.current = hoveredNode?.id ?? null;
  }

  function handlePointerUp() {
    pointerRef.current = { mode: "idle" };
  }

  function handlePointerLeave() {
    if (pointerRef.current.mode === "idle") {
      hoveredIdRef.current = null;
    }
  }

  function handleWheel(event: WheelEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    event.preventDefault();

    const bounds = canvas.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const worldBefore = screenToWorld({
      x: pointerX,
      y: pointerY,
      camera: cameraRef.current,
    });

    const delta = event.deltaY < 0 ? 1.08 : 0.92;
    cameraRef.current.scale = clamp(cameraRef.current.scale * delta, 0.42, 2.8);
    cameraRef.current.x = pointerX - worldBefore.x * cameraRef.current.scale;
    cameraRef.current.y = pointerY - worldBefore.y * cameraRef.current.scale;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const panStep = event.shiftKey ? 60 : 24;
    if (event.key === "+") {
      event.preventDefault();
      cameraRef.current.scale = clamp(cameraRef.current.scale * 1.08, 0.42, 2.8);
      return;
    }

    if (event.key === "-") {
      event.preventDefault();
      cameraRef.current.scale = clamp(cameraRef.current.scale * 0.92, 0.42, 2.8);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      cameraRef.current.x += panStep;
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      cameraRef.current.x -= panStep;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      cameraRef.current.y += panStep;
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      cameraRef.current.y -= panStep;
    }
  }

  return (
    <div
      className={["md-graph-view", className].filter(Boolean).join(" ")}
      style={{ height, ...style }}
      data-graph-id={graphId}
    >
      <aside className="md-graph-pane md-graph-pane-files">
        <div className="md-graph-pane-header">
          <div>
            <p className="md-graph-label">Markdown Vault</p>
            <h2 className="md-graph-title">Files</h2>
          </div>
          <button
            className="md-graph-icon-button"
            type="button"
            onClick={() => onCreateUnresolved?.({ id: "missing:new-file", label: "New Note" })}
            aria-label="Create new file"
          >
            +
          </button>
        </div>

        <label className="md-graph-field md-graph-field-compact">
          <span>Open file</span>
          <input
            type="search"
            placeholder="Filter files..."
            value={sidebarQuery}
            onChange={(event) => setSidebarQuery(event.target.value)}
          />
        </label>

        <div className="md-graph-file-list">
          {filteredDocuments.length ? (
            filteredDocuments.map((node) => (
              <button
                key={node.id}
                className={[
                  "md-graph-file-item",
                  node.id === effectiveSelectedNodeId ? "md-graph-file-item-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                onClick={() => {
                  selectNode(node);
                  centerOnNode(node.id);
                }}
              >
                <span className="md-graph-file-icon" aria-hidden="true" />
                <span className="md-graph-file-body">
                  <span className="md-graph-file-title">{node.label}</span>
                  <span className="md-graph-file-meta">{node.outgoingCount} outgoing links</span>
                </span>
              </button>
            ))
          ) : (
            <div className="md-graph-empty">
              No files match the current filter. Clear the search or refresh the markdown index.
            </div>
          )}
        </div>

        <section className="md-graph-details">
          <div className="md-graph-section-head">
            <div>
              <p className="md-graph-label">Selection</p>
              <h3>{selectedNode?.label ?? "No selection"}</h3>
            </div>
            {selectedNode && !selectedNode.hasDocument ? (
              <button
                className="md-graph-soft-button"
                type="button"
                onClick={() =>
                  onCreateUnresolved?.({ id: selectedNode.id, label: selectedNode.label })
                }
                disabled={!onCreateUnresolved}
              >
                Create file
              </button>
            ) : null}
          </div>

          <ul className="md-graph-details-list">
            <li>
              <span>Status</span>
              <span>{selectedNode ? (selectedNode.hasDocument ? "Existing file" : "Unresolved link") : "None"}</span>
            </li>
            <li>
              <span>Path</span>
              <span>{selectedNode?.sourcePath ?? "Not created yet"}</span>
            </li>
            <li>
              <span>Backlinks</span>
              <span>{selectedNode?.inboundCount ?? 0}</span>
            </li>
            <li>
              <span>Outgoing</span>
              <span>{selectedNode?.outgoingCount ?? 0}</span>
            </li>
            <li>
              <span>Connections</span>
              <span>{selectedNode?.totalConnections ?? 0}</span>
            </li>
            <li>
              <span>Aliases</span>
              <span>{selectedAliases}</span>
            </li>
          </ul>

          <p className="md-graph-field-help">
            The component parses markdown contents directly, so graph edges come from `[[wiki links]]`
            and internal markdown file links, not from TypeScript source files.
          </p>
        </section>
      </aside>

      <main className="md-graph-pane md-graph-pane-graph">
        <header className="md-graph-graph-header">
          <div>
            <p className="md-graph-label">Graph</p>
            <h2 className="md-graph-subtitle">Graph view</h2>
          </div>

          <div className="md-graph-toolbar">
            <button
              className="md-graph-soft-button"
              type="button"
              onClick={() => centerOnNode(effectiveSelectedNodeId)}
            >
              Center on file
            </button>
            <button
              className="md-graph-soft-button"
              type="button"
              onClick={() => {
                simulationNodesRef.current.clear();
                simulationNodesRef.current = new Map();
                graphModel.nodes.forEach((node, index) => {
                  simulationNodesRef.current.set(node.id, {
                    id: node.id,
                    x: randomPosition(index).x,
                    y: randomPosition(index).y,
                    vx: 0,
                    vy: 0,
                  });
                });
                centerOnNode(effectiveSelectedNodeId);
              }}
            >
              Reset layout
            </button>
          </div>
        </header>

        <section
          ref={stageRef}
          className="md-graph-stage"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          aria-label="Markdown graph canvas"
        >
          <canvas
            ref={canvasRef}
            className="md-graph-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onWheel={handleWheel}
          />

          <div className="md-graph-chip md-graph-chip-top-left">
            {selectedNode
              ? `${selectedNode.label} · ${selectedNode.inboundCount} backlinks · ${selectedNode.totalConnections} connections`
              : "No file selected"}
          </div>
          <div className="md-graph-chip md-graph-chip-top-right">
            {graphModel.visibleNodes.filter((node) => node.hasDocument).length} files ·{" "}
            {graphModel.visibleDirectedEdges.length} links ·{" "}
            {graphModel.visibleNodes.filter((node) => !node.hasDocument).length} unresolved
          </div>
          <div className="md-graph-chip md-graph-chip-bottom-left">
            Scroll to zoom · Drag background to pan · Arrow keys to move
          </div>
          <div className="md-graph-chip md-graph-chip-bottom-right">
            Drag a node to reposition it
          </div>
        </section>
      </main>

      <aside className="md-graph-pane md-graph-pane-settings">
        <div className="md-graph-pane-header">
          <div>
            <p className="md-graph-label">View Controls</p>
            <h2 className="md-graph-subtitle">Graph settings</h2>
          </div>
        </div>

        <section className="md-graph-settings-section">
          <div className="md-graph-section-head">
            <h3>Filters</h3>
          </div>

          <label className="md-graph-field md-graph-field-compact">
            <span>Search files</span>
            <input
              type="search"
              placeholder="Search graph files..."
              value={settings.fileSearch}
              onChange={(event) => updateSettings("fileSearch", event.target.value)}
            />
          </label>

          <label className="md-graph-toggle-row">
            <span>Existing files only</span>
            <input
              type="checkbox"
              checked={settings.existingFilesOnly}
              onChange={(event) => updateSettings("existingFilesOnly", event.target.checked)}
            />
          </label>

          <label className="md-graph-toggle-row">
            <span>Orphans</span>
            <input
              type="checkbox"
              checked={settings.showOrphans}
              onChange={(event) => updateSettings("showOrphans", event.target.checked)}
            />
          </label>
        </section>

        <section className="md-graph-settings-section">
          <div className="md-graph-section-head">
            <h3>Groups</h3>
            <button
              className="md-graph-text-button"
              type="button"
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  groups: [...current.groups, createGraphGroup()],
                }))
              }
            >
              New group
            </button>
          </div>

          <div className="md-graph-group-list">
            {settings.groups.length ? (
              settings.groups.map((group) => (
                <div key={group.id} className="md-graph-group-row">
                  <input
                    className="md-graph-group-color"
                    type="color"
                    value={group.color}
                    onChange={(event) => updateGroup(group.id, { color: event.target.value })}
                    aria-label="Group color"
                  />
                  <input
                    className="md-graph-group-text"
                    type="text"
                    value={group.query}
                    onChange={(event) => updateGroup(group.id, { query: event.target.value })}
                    placeholder="Search term"
                  />
                  <button
                    className="md-graph-group-remove"
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    aria-label="Remove group"
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div className="md-graph-empty">
                No color groups yet. Add one to color notes by query or tag text.
              </div>
            )}
          </div>
        </section>

        <section className="md-graph-settings-section">
          <div className="md-graph-section-head">
            <h3>Display</h3>
          </div>

          <label className="md-graph-toggle-row">
            <span>Arrows</span>
            <input
              type="checkbox"
              checked={settings.showArrows}
              onChange={(event) => updateSettings("showArrows", event.target.checked)}
            />
          </label>

          <label className="md-graph-toggle-row">
            <span>Animate</span>
            <input
              type="checkbox"
              checked={settings.animate}
              onChange={(event) => updateSettings("animate", event.target.checked)}
            />
          </label>

          <label className="md-graph-range-row">
            <span>Text fade threshold</span>
            <output>{settings.textFadeThreshold.toFixed(2)}</output>
          </label>
          <input
            className="md-graph-range-input"
            type="range"
            min="0.1"
            max="1.2"
            step="0.01"
            value={settings.textFadeThreshold}
            onChange={(event) => updateSettings("textFadeThreshold", Number(event.target.value))}
          />

          <label className="md-graph-range-row">
            <span>Node size</span>
            <output>{settings.nodeSize.toFixed(2)}</output>
          </label>
          <input
            className="md-graph-range-input"
            type="range"
            min="0.6"
            max="2.4"
            step="0.05"
            value={settings.nodeSize}
            onChange={(event) => updateSettings("nodeSize", Number(event.target.value))}
          />

          <label className="md-graph-range-row">
            <span>Link thickness</span>
            <output>{settings.linkThickness.toFixed(2)}</output>
          </label>
          <input
            className="md-graph-range-input"
            type="range"
            min="0.4"
            max="2.4"
            step="0.05"
            value={settings.linkThickness}
            onChange={(event) => updateSettings("linkThickness", Number(event.target.value))}
          />
        </section>

        <section className="md-graph-settings-section">
          <div className="md-graph-section-head">
            <h3>Forces</h3>
          </div>

          <label className="md-graph-range-row">
            <span>Center force</span>
            <output>{settings.centerForce.toFixed(2)}</output>
          </label>
          <input
            className="md-graph-range-input"
            type="range"
            min="0.02"
            max="0.5"
            step="0.01"
            value={settings.centerForce}
            onChange={(event) => updateSettings("centerForce", Number(event.target.value))}
          />

          <label className="md-graph-range-row">
            <span>Repel force</span>
            <output>{settings.repelForce.toFixed(2)}</output>
          </label>
          <input
            className="md-graph-range-input"
            type="range"
            min="0.1"
            max="1.5"
            step="0.01"
            value={settings.repelForce}
            onChange={(event) => updateSettings("repelForce", Number(event.target.value))}
          />

          <label className="md-graph-range-row">
            <span>Link force</span>
            <output>{settings.linkForce.toFixed(2)}</output>
          </label>
          <input
            className="md-graph-range-input"
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={settings.linkForce}
            onChange={(event) => updateSettings("linkForce", Number(event.target.value))}
          />

          <label className="md-graph-range-row">
            <span>Link distance</span>
            <output>{settings.linkDistance}</output>
          </label>
          <input
            className="md-graph-range-input"
            type="range"
            min="60"
            max="220"
            step="2"
            value={settings.linkDistance}
            onChange={(event) => updateSettings("linkDistance", Number(event.target.value))}
          />
        </section>
      </aside>
    </div>
  );
}

function randomPosition(index: number) {
  const angle = index * 1.73;
  const radius = 90 + index * 17;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function sizeCanvas(canvas: HTMLCanvasElement, stage: HTMLDivElement, camera: CameraState) {
  const ratio = window.devicePixelRatio || 1;
  const bounds = stage.getBoundingClientRect();
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);

  if (!camera.x && !camera.y) {
    camera.x = bounds.width / 2;
    camera.y = bounds.height / 2;
  }
}

function runSimulation({
  model,
  settings,
  pointer,
  simulationNodes,
}: {
  model: MarkdownGraphModel;
  settings: MarkdownGraphSettings;
  pointer: PointerState;
  simulationNodes: Map<string, SimulationNode>;
}) {
  if (!settings.animate && pointer.mode === "idle") {
    return;
  }

  const repulsionStrength = 3800 * settings.repelForce;
  const linkStrength = 0.022 * settings.linkForce;
  const preferredDistance = settings.linkDistance;
  const centerStrength = 0.0016 * settings.centerForce;
  const collisionPadding = 16;
  const maxVelocity = 3.2;
  const visibleNodes = model.visibleNodes.map((node) => ({
    node,
    simulation: simulationNodes.get(node.id),
  }));

  for (let index = 0; index < visibleNodes.length; index += 1) {
    const current = visibleNodes[index];
    if (!current.simulation) {
      continue;
    }

    for (let otherIndex = index + 1; otherIndex < visibleNodes.length; otherIndex += 1) {
      const other = visibleNodes[otherIndex];
      if (!other.simulation) {
        continue;
      }

      const dx = other.simulation.x - current.simulation.x;
      const dy = other.simulation.y - current.simulation.y;
      const distanceSq = dx * dx + dy * dy + 0.01;
      const distance = Math.sqrt(distanceSq);
      const force = repulsionStrength / distanceSq;
      const forceX = (dx / distance) * force;
      const forceY = (dy / distance) * force;

      current.simulation.vx -= forceX;
      current.simulation.vy -= forceY;
      other.simulation.vx += forceX;
      other.simulation.vy += forceY;

      const minimumDistance = current.node.radiusBase + other.node.radiusBase + collisionPadding;
      if (distance < minimumDistance) {
        const overlap = (minimumDistance - distance) * 0.04;
        const pushX = (dx / distance) * overlap;
        const pushY = (dy / distance) * overlap;
        current.simulation.vx -= pushX;
        current.simulation.vy -= pushY;
        other.simulation.vx += pushX;
        other.simulation.vy += pushY;
      }
    }
  }

  for (const edge of model.visibleDirectedEdges) {
    const source = simulationNodes.get(edge.sourceId);
    const target = simulationNodes.get(edge.targetId);
    if (!source || !target) {
      continue;
    }

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 0.0001;
    const difference = distance - preferredDistance;
    const force = difference * linkStrength;
    const forceX = (dx / distance) * force;
    const forceY = (dy / distance) * force;

    source.vx += forceX;
    source.vy += forceY;
    target.vx -= forceX;
    target.vy -= forceY;
  }

  for (const visibleNode of visibleNodes) {
    const simulationNode = visibleNode.simulation;
    if (!simulationNode) {
      continue;
    }

    simulationNode.vx += -simulationNode.x * centerStrength;
    simulationNode.vy += -simulationNode.y * centerStrength;

    if (pointer.mode === "drag-node" && pointer.nodeId === visibleNode.node.id) {
      simulationNode.vx = 0;
      simulationNode.vy = 0;
      continue;
    }

    simulationNode.vx *= 0.87;
    simulationNode.vy *= 0.87;
    simulationNode.vx = clamp(simulationNode.vx, -maxVelocity, maxVelocity);
    simulationNode.vy = clamp(simulationNode.vy, -maxVelocity, maxVelocity);
    simulationNode.x += simulationNode.vx;
    simulationNode.y += simulationNode.vy;
  }
}

function drawGraph({
  canvas,
  context,
  model,
  camera,
  settings,
  selectedNodeId,
  hoveredNodeId,
  simulationNodes,
}: {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  model: MarkdownGraphModel;
  camera: CameraState;
  settings: MarkdownGraphSettings;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  simulationNodes: Map<string, SimulationNode>;
}) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  drawBackdrop({ context, width, height, camera });

  if (settings.showArrows) {
    for (const edge of model.visibleDirectedEdges) {
      const sourceNode = model.nodesById.get(edge.sourceId);
      const targetNode = model.nodesById.get(edge.targetId);
      const source = simulationNodes.get(edge.sourceId);
      const target = simulationNodes.get(edge.targetId);
      if (!sourceNode || !targetNode || !source || !target) {
        continue;
      }

      const sourcePoint = worldToScreen({ x: source.x, y: source.y, camera });
      const targetPoint = worldToScreen({ x: target.x, y: target.y, camera });
      const emphasis = Math.max(
        getNodeEmphasis(edge.sourceId, hoveredNodeId, selectedNodeId, model.neighborMap, model.nodesById),
        getNodeEmphasis(edge.targetId, hoveredNodeId, selectedNodeId, model.neighborMap, model.nodesById),
      );

      context.beginPath();
      context.moveTo(sourcePoint.x, sourcePoint.y);
      context.lineTo(targetPoint.x, targetPoint.y);
      context.lineWidth = 0.8 + settings.linkThickness * 0.6;
      context.strokeStyle = withAlpha("#8da0c2", 0.2 + emphasis * 0.45);
      context.stroke();
      drawArrow(context, sourcePoint, targetPoint, 0.26 + emphasis * 0.52);
    }
  } else {
    for (const edge of model.visibleDisplayEdges) {
      const source = simulationNodes.get(edge.sourceId);
      const target = simulationNodes.get(edge.targetId);
      if (!source || !target) {
        continue;
      }

      const sourcePoint = worldToScreen({ x: source.x, y: source.y, camera });
      const targetPoint = worldToScreen({ x: target.x, y: target.y, camera });
      const emphasis = Math.max(
        getNodeEmphasis(edge.sourceId, hoveredNodeId, selectedNodeId, model.neighborMap, model.nodesById),
        getNodeEmphasis(edge.targetId, hoveredNodeId, selectedNodeId, model.neighborMap, model.nodesById),
      );

      context.beginPath();
      context.moveTo(sourcePoint.x, sourcePoint.y);
      context.lineTo(targetPoint.x, targetPoint.y);
      context.lineWidth = 0.9 + settings.linkThickness * 0.75;
      context.strokeStyle = withAlpha("#8da0c2", 0.14 + emphasis * 0.38);
      context.stroke();
    }
  }

  const orderedNodes = [...model.visibleNodes].sort((left, right) => left.radiusBase - right.radiusBase);
  for (const node of orderedNodes) {
    const simulationNode = simulationNodes.get(node.id);
    if (!simulationNode) {
      continue;
    }

    const point = worldToScreen({ x: simulationNode.x, y: simulationNode.y, camera });
    const emphasis = getNodeEmphasis(node.id, hoveredNodeId, selectedNodeId, model.neighborMap, model.nodesById);
    const selected = node.id === selectedNodeId;
    const hovered = node.id === hoveredNodeId;
    const radius = node.radiusBase * camera.scale * (selected ? 1.12 : hovered ? 1.08 : 1);

    context.beginPath();
    context.arc(point.x, point.y, radius + 6, 0, Math.PI * 2);
    context.fillStyle = withAlpha(node.color, selected ? 0.12 : hovered ? 0.08 : 0.03);
    context.fill();

    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = withAlpha(node.color, 0.55 + emphasis * 0.45);
    context.fill();
    context.lineWidth = selected ? 1.7 : 1;
    context.strokeStyle = selected ? "rgba(255,255,255,0.82)" : "rgba(12,15,19,0.84)";
    context.stroke();

    const labelVisibility = clamp(
      (camera.scale - settings.textFadeThreshold + (selected || hovered ? 0.4 : 0)) / 0.45,
      0,
      1,
    );

    if (labelVisibility > 0.03) {
      context.fillStyle = `rgba(215, 220, 229, ${labelVisibility * emphasis})`;
      context.font = selected ? "600 12px Inter, sans-serif" : "500 11px Inter, sans-serif";
      context.textBaseline = "middle";
      context.fillText(node.label, point.x + radius + 8, point.y);
    }
  }
}

function drawBackdrop({
  context,
  width,
  height,
  camera,
}: {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  camera: CameraState;
}) {
  context.fillStyle = "#111318";
  context.fillRect(0, 0, width, height);

  const spacing = 26 * camera.scale;
  const offsetX = ((camera.x % spacing) + spacing) % spacing;
  const offsetY = ((camera.y % spacing) + spacing) % spacing;
  context.fillStyle = "rgba(255, 255, 255, 0.045)";

  for (let x = offsetX; x < width; x += spacing) {
    for (let y = offsetY; y < height; y += spacing) {
      context.beginPath();
      context.arc(x, y, 1.05, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawArrow(
  context: CanvasRenderingContext2D,
  source: { x: number; y: number },
  target: { x: number; y: number },
  opacity: number,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const angle = Math.atan2(dy, dx);
  const arrowLength = 8;
  const spread = Math.PI / 7;

  context.beginPath();
  context.moveTo(target.x, target.y);
  context.lineTo(
    target.x - Math.cos(angle - spread) * arrowLength,
    target.y - Math.sin(angle - spread) * arrowLength,
  );
  context.moveTo(target.x, target.y);
  context.lineTo(
    target.x - Math.cos(angle + spread) * arrowLength,
    target.y - Math.sin(angle + spread) * arrowLength,
  );
  context.strokeStyle = `rgba(154, 179, 255, ${opacity})`;
  context.stroke();
}

function getNodeEmphasis(
  nodeId: string,
  hoveredNodeId: string | null,
  selectedNodeId: string | null,
  neighborMap: Map<string, Set<string>>,
  nodesById: Map<string, MarkdownGraphNode>,
) {
  if (!hoveredNodeId && !selectedNodeId) {
    return 1;
  }

  const focalId = hoveredNodeId || selectedNodeId;
  if (!focalId || !nodesById.has(focalId)) {
    return 1;
  }
  if (nodeId === focalId) {
    return 1;
  }

  const neighbors = neighborMap.get(focalId) || new Set<string>();
  return neighbors.has(nodeId) ? 0.74 : 0.16;
}

function findNodeAtPosition({
  clientX,
  clientY,
  canvas,
  camera,
  model,
  simulationNodes,
}: {
  clientX: number;
  clientY: number;
  canvas: HTMLCanvasElement;
  camera: CameraState;
  model: MarkdownGraphModel;
  simulationNodes: Map<string, SimulationNode>;
}) {
  const bounds = canvas.getBoundingClientRect();
  const x = clientX - bounds.left;
  const y = clientY - bounds.top;
  let hitNode: MarkdownGraphNode | null = null;

  for (const node of model.visibleNodes) {
    const simulationNode = simulationNodes.get(node.id);
    if (!simulationNode) {
      continue;
    }

    const point = worldToScreen({ x: simulationNode.x, y: simulationNode.y, camera });
    const radius = (node.radiusBase + 6) * camera.scale;
    if (Math.hypot(point.x - x, point.y - y) <= radius) {
      hitNode = node;
    }
  }

  return hitNode;
}

function worldToScreen({
  x,
  y,
  camera,
}: {
  x: number;
  y: number;
  camera: CameraState;
}) {
  return {
    x: x * camera.scale + camera.x,
    y: y * camera.scale + camera.y,
  };
}

function screenToWorld({
  x,
  y,
  camera,
}: {
  x: number;
  y: number;
  camera: CameraState;
}) {
  return {
    x: (x - camera.x) / camera.scale,
    y: (y - camera.y) / camera.scale,
  };
}

function withAlpha(hex: string, alpha: number) {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
