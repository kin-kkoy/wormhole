const INITIAL_NOTES = [
  {
    title: "Daily Notes",
    body:
      "Daily notes link outward to [[Graph View]], [[Plugins]], and [[Linking Strategy]]. They also surface [[Unresolved Link]] placeholders.",
  },
  {
    title: "Graph View",
    body:
      "The vault graph references [[Backlinks]], [[Linking Strategy]], [[Visual Tuning]], and [[Local Graph]].",
  },
  {
    title: "Backlinks",
    body:
      "Backlinks make high-reference files larger in the graph. Compare with [[Graph View]] and [[Knowledge Modeling]].",
  },
  {
    title: "Linking Strategy",
    body:
      "Use wiki links like [[Visual Tuning]] and [[Knowledge Modeling|Models]] so relationships remain visible.",
  },
  {
    title: "Visual Tuning",
    body:
      "Adjust node size, text fade, arrows, and line strength. Compare with [[Graph View]] and [[Plugins]].",
  },
  {
    title: "Plugins",
    body: "Core plugins influence workflows around [[Daily Notes]], [[Local Graph]], and [[Graph View]].",
  },
  {
    title: "Local Graph",
    body:
      "Local Graph narrows visibility around the active file while preserving connections to [[Graph View]].",
  },
];

const LINK_PATTERN = /\[\[([^[\]]+)\]\]/g;
const GROUP_COLORS = ["#7d8dff", "#4fb79f", "#d09a4f", "#b869e0", "#5f9af4"];

const state = {
  notes: structuredClone(INITIAL_NOTES),
  allNodes: [],
  visibleNodes: [],
  directedLinks: [],
  visibleDirectedLinks: [],
  visibleDisplayLinks: [],
  visibleNeighborMap: new Map(),
  selectedId: "Graph View",
  hoveredId: null,
  searchValue: "",
  settings: {
    fileSearch: "",
    existingFilesOnly: false,
    showOrphans: true,
    showArrows: false,
    animate: true,
    textFadeThreshold: 0.52,
    nodeSize: 1,
    linkThickness: 1,
    centerForce: 0.22,
    repelForce: 0.78,
    linkForce: 0.44,
    linkDistance: 130,
    groups: [
      { id: crypto.randomUUID(), query: "Daily", color: GROUP_COLORS[0] },
      { id: crypto.randomUUID(), query: "Graph", color: GROUP_COLORS[1] },
    ],
  },
  camera: {
    x: 0,
    y: 0,
    scale: 1,
  },
  pointer: {
    mode: "idle",
    nodeId: null,
    offsetX: 0,
    offsetY: 0,
    originX: 0,
    originY: 0,
    cameraX: 0,
    cameraY: 0,
  },
};

const noteList = document.querySelector("#note-list");
const searchInput = document.querySelector("#search-input");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const editorTitleLabel = document.querySelector("#editor-title-label");
const editorHelp = document.querySelector("#editor-help");
const selectionChip = document.querySelector("#selection-chip");
const graphStats = document.querySelector("#graph-stats");
const addNoteButton = document.querySelector("#add-note-button");
const createMissingNoteButton = document.querySelector("#create-missing-note-button");
const centerSelectionButton = document.querySelector("#center-selection-button");
const resetLayoutButton = document.querySelector("#reset-layout-button");
const filterSearchInput = document.querySelector("#filter-search-input");
const existingFilesToggle = document.querySelector("#existing-files-toggle");
const orphansToggle = document.querySelector("#orphans-toggle");
const arrowsToggle = document.querySelector("#arrows-toggle");
const animateToggle = document.querySelector("#animate-toggle");
const textFadeInput = document.querySelector("#text-fade-input");
const textFadeValue = document.querySelector("#text-fade-value");
const nodeSizeInput = document.querySelector("#node-size-input");
const nodeSizeValue = document.querySelector("#node-size-value");
const linkThicknessInput = document.querySelector("#link-thickness-input");
const linkThicknessValue = document.querySelector("#link-thickness-value");
const centerForceInput = document.querySelector("#center-force-input");
const centerForceValue = document.querySelector("#center-force-value");
const repelForceInput = document.querySelector("#repel-force-input");
const repelForceValue = document.querySelector("#repel-force-value");
const linkForceInput = document.querySelector("#link-force-input");
const linkForceValue = document.querySelector("#link-force-value");
const linkDistanceInput = document.querySelector("#link-distance-input");
const linkDistanceValue = document.querySelector("#link-distance-value");
const groupList = document.querySelector("#group-list");
const addGroupButton = document.querySelector("#add-group-button");
const canvas = document.querySelector("#graph-canvas");
const context = canvas.getContext("2d");

function parseLinks(body) {
  const links = [];
  for (const match of body.matchAll(LINK_PATTERN)) {
    const raw = match[1].trim();
    if (!raw) {
      continue;
    }

    const target = raw.split("|")[0].split("#")[0].split("^")[0].trim();
    if (target) {
      links.push(target);
    }
  }
  return links;
}

function randomPosition(index) {
  const angle = index * 1.73;
  const radius = 90 + index * 17;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function normalizedIncludes(value, query) {
  return value.toLowerCase().includes(query.toLowerCase());
}

function hasDocument(title) {
  return state.notes.some((note) => note.title === title);
}

function getSelectedNote() {
  return state.notes.find((note) => note.title === state.selectedId) || null;
}

function getNodeById(nodeId) {
  return state.allNodes.find((node) => node.id === nodeId) || null;
}

function getVisibleNodeById(nodeId) {
  return state.visibleNodes.find((node) => node.id === nodeId) || null;
}

function uniqueTitle(baseTitle, currentTitle = null) {
  const normalized = baseTitle.trim().replace(/\s+/g, " ") || "Untitled";
  if (!state.notes.some((note) => note.title === normalized && note.title !== currentTitle)) {
    return normalized;
  }

  let index = 2;
  while (
    state.notes.some(
      (note) => note.title === `${normalized} ${index}` && note.title !== currentTitle,
    )
  ) {
    index += 1;
  }
  return `${normalized} ${index}`;
}

function getGroupColorForNode(node) {
  for (const group of state.settings.groups) {
    const query = group.query.trim();
    if (!query) {
      continue;
    }

    if (
      normalizedIncludes(node.id, query) ||
      (node.body && normalizedIncludes(node.body, query))
    ) {
      return group.color;
    }
  }
  return node.hasDocument ? "#6b8eea" : "#7c838f";
}

function buildGraph() {
  const previousNodes = new Map(state.allNodes.map((node) => [node.id, node]));
  const nodeMap = new Map();
  const directedLinks = [];

  function ensureNode(id, documentBacked, body = "") {
    if (!nodeMap.has(id)) {
      const previous = previousNodes.get(id);
      const fallback = randomPosition(nodeMap.size + 1);
      nodeMap.set(id, {
        id,
        label: id,
        body,
        hasDocument: documentBacked,
        x: previous ? previous.x : fallback.x,
        y: previous ? previous.y : fallback.y,
        vx: previous ? previous.vx : 0,
        vy: previous ? previous.vy : 0,
        inboundCount: 0,
        totalConnections: 0,
        radiusBase: 5,
        color: documentBacked ? "#6b8eea" : "#7c838f",
      });
    } else if (documentBacked) {
      const existing = nodeMap.get(id);
      existing.hasDocument = true;
      existing.body = body;
    }
    return nodeMap.get(id);
  }

  for (const note of state.notes) {
    ensureNode(note.title, true, note.body);
  }

  for (const note of state.notes) {
    const source = ensureNode(note.title, true, note.body);
    for (const targetTitle of parseLinks(note.body)) {
      if (targetTitle === source.id) {
        continue;
      }

      const target = ensureNode(targetTitle, hasDocument(targetTitle));
      directedLinks.push({
        sourceId: source.id,
        targetId: target.id,
      });
    }
  }

  for (const link of directedLinks) {
    const source = nodeMap.get(link.sourceId);
    const target = nodeMap.get(link.targetId);
    if (!source || !target) {
      continue;
    }
    target.inboundCount += 1;
    source.totalConnections += 1;
    target.totalConnections += 1;
  }

  for (const node of nodeMap.values()) {
    const backlinkBoost = Math.sqrt(node.inboundCount) * 2.5 * state.settings.nodeSize;
    node.radiusBase = (node.hasDocument ? 4.8 : 3.4) + backlinkBoost;
    node.color = getGroupColorForNode(node);
  }

  state.allNodes = Array.from(nodeMap.values());
  state.directedLinks = directedLinks;

  const matchedIds = new Set();
  const graphQuery = state.settings.fileSearch.trim();
  for (const node of state.allNodes) {
    const match =
      !graphQuery ||
      normalizedIncludes(node.id, graphQuery) ||
      normalizedIncludes(node.body || "", graphQuery);
    if (!match) {
      continue;
    }
    if (state.settings.existingFilesOnly && !node.hasDocument) {
      continue;
    }
    matchedIds.add(node.id);
  }

  const visibleDirectedLinks = state.directedLinks.filter(
    (link) => matchedIds.has(link.sourceId) && matchedIds.has(link.targetId),
  );

  const incidentCounts = new Map();
  for (const link of visibleDirectedLinks) {
    incidentCounts.set(link.sourceId, (incidentCounts.get(link.sourceId) || 0) + 1);
    incidentCounts.set(link.targetId, (incidentCounts.get(link.targetId) || 0) + 1);
  }

  const visibleNodes = state.allNodes.filter((node) => {
    if (!matchedIds.has(node.id)) {
      return false;
    }
    if (state.settings.showOrphans) {
      return true;
    }
    return (incidentCounts.get(node.id) || 0) > 0;
  });

  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  state.visibleNodes = visibleNodes;
  state.visibleDirectedLinks = visibleDirectedLinks.filter(
    (link) => visibleIds.has(link.sourceId) && visibleIds.has(link.targetId),
  );

  const displayLinkMap = new Map();
  const neighborMap = new Map();
  for (const link of state.visibleDirectedLinks) {
    const key = [link.sourceId, link.targetId].sort().join("::");
    if (!displayLinkMap.has(key)) {
      displayLinkMap.set(key, {
        sourceId: link.sourceId,
        targetId: link.targetId,
        pairKey: key,
        reciprocal:
          state.visibleDirectedLinks.some(
            (candidate) =>
              candidate.sourceId === link.targetId && candidate.targetId === link.sourceId,
          ),
      });
    }

    if (!neighborMap.has(link.sourceId)) {
      neighborMap.set(link.sourceId, new Set());
    }
    if (!neighborMap.has(link.targetId)) {
      neighborMap.set(link.targetId, new Set());
    }

    neighborMap.get(link.sourceId).add(link.targetId);
    neighborMap.get(link.targetId).add(link.sourceId);
  }

  state.visibleDisplayLinks = Array.from(displayLinkMap.values());
  state.visibleNeighborMap = neighborMap;
}

function setCanvasSize() {
  const ratio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (!state.camera.x && !state.camera.y) {
    state.camera.x = bounds.width / 2;
    state.camera.y = bounds.height / 2;
  }
}

function worldToScreen(x, y) {
  return {
    x: x * state.camera.scale + state.camera.x,
    y: y * state.camera.scale + state.camera.y,
  };
}

function screenToWorld(x, y) {
  return {
    x: (x - state.camera.x) / state.camera.scale,
    y: (y - state.camera.y) / state.camera.scale,
  };
}

function runSimulation() {
  if (!state.settings.animate && state.pointer.mode === "idle") {
    return;
  }

  const repulsionStrength = 3800 * state.settings.repelForce;
  const linkStrength = 0.022 * state.settings.linkForce;
  const preferredLinkDistance = state.settings.linkDistance;
  const centerStrength = 0.0016 * state.settings.centerForce;
  const collisionPadding = 16;
  const maxVelocity = 3.2;

  for (let index = 0; index < state.visibleNodes.length; index += 1) {
    const node = state.visibleNodes[index];
    for (let otherIndex = index + 1; otherIndex < state.visibleNodes.length; otherIndex += 1) {
      const other = state.visibleNodes[otherIndex];
      const dx = other.x - node.x;
      const dy = other.y - node.y;
      const distanceSq = dx * dx + dy * dy + 0.01;
      const distance = Math.sqrt(distanceSq);
      const force = repulsionStrength / distanceSq;
      const forceX = (dx / distance) * force;
      const forceY = (dy / distance) * force;

      node.vx -= forceX;
      node.vy -= forceY;
      other.vx += forceX;
      other.vy += forceY;

      const minimumDistance = node.radiusBase + other.radiusBase + collisionPadding;
      if (distance < minimumDistance) {
        const overlap = (minimumDistance - distance) * 0.04;
        const pushX = (dx / distance) * overlap;
        const pushY = (dy / distance) * overlap;
        node.vx -= pushX;
        node.vy -= pushY;
        other.vx += pushX;
        other.vy += pushY;
      }
    }
  }

  for (const link of state.visibleDirectedLinks) {
    const source = getVisibleNodeById(link.sourceId);
    const target = getVisibleNodeById(link.targetId);
    if (!source || !target) {
      continue;
    }

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 0.0001;
    const difference = distance - preferredLinkDistance;
    const force = difference * linkStrength;
    const forceX = (dx / distance) * force;
    const forceY = (dy / distance) * force;

    source.vx += forceX;
    source.vy += forceY;
    target.vx -= forceX;
    target.vy -= forceY;
  }

  for (const node of state.visibleNodes) {
    node.vx += -node.x * centerStrength;
    node.vy += -node.y * centerStrength;

    if (state.pointer.mode === "drag-node" && state.pointer.nodeId === node.id) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    node.vx *= 0.87;
    node.vy *= 0.87;
    node.vx = Math.max(-maxVelocity, Math.min(maxVelocity, node.vx));
    node.vy = Math.max(-maxVelocity, Math.min(maxVelocity, node.vy));

    node.x += node.vx;
    node.y += node.vy;
  }
}

function drawBackdrop(width, height) {
  context.fillStyle = "#111318";
  context.fillRect(0, 0, width, height);

  const spacing = 26 * state.camera.scale;
  const offsetX = ((state.camera.x % spacing) + spacing) % spacing;
  const offsetY = ((state.camera.y % spacing) + spacing) % spacing;

  context.fillStyle = "rgba(255, 255, 255, 0.045)";
  for (let x = offsetX; x < width; x += spacing) {
    for (let y = offsetY; y < height; y += spacing) {
      context.beginPath();
      context.arc(x, y, 1.05, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function getNodeEmphasis(nodeId) {
  if (!state.hoveredId && !state.selectedId) {
    return 1;
  }

  const focalId = state.hoveredId || state.selectedId;
  if (!getVisibleNodeById(focalId)) {
    return 1;
  }
  if (nodeId === focalId) {
    return 1;
  }

  const neighbors = state.visibleNeighborMap.get(focalId) || new Set();
  return neighbors.has(nodeId) ? 0.74 : 0.16;
}

function drawArrow(sourcePoint, targetPoint, color, opacityScale) {
  const dx = targetPoint.x - sourcePoint.x;
  const dy = targetPoint.y - sourcePoint.y;
  const angle = Math.atan2(dy, dx);
  const arrowLength = 8;
  const arrowSpread = Math.PI / 7;

  context.beginPath();
  context.moveTo(targetPoint.x, targetPoint.y);
  context.lineTo(
    targetPoint.x - Math.cos(angle - arrowSpread) * arrowLength,
    targetPoint.y - Math.sin(angle - arrowSpread) * arrowLength,
  );
  context.moveTo(targetPoint.x, targetPoint.y);
  context.lineTo(
    targetPoint.x - Math.cos(angle + arrowSpread) * arrowLength,
    targetPoint.y - Math.sin(angle + arrowSpread) * arrowLength,
  );
  context.strokeStyle = withAlpha(color, opacityScale);
  context.stroke();
}

function withAlpha(hexColor, alpha) {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawGraph() {
  const bounds = canvas.getBoundingClientRect();
  context.clearRect(0, 0, bounds.width, bounds.height);
  drawBackdrop(bounds.width, bounds.height);

  if (state.settings.showArrows) {
    for (const link of state.visibleDirectedLinks) {
      const source = getVisibleNodeById(link.sourceId);
      const target = getVisibleNodeById(link.targetId);
      if (!source || !target) {
        continue;
      }

      const sourcePoint = worldToScreen(source.x, source.y);
      const targetPoint = worldToScreen(target.x, target.y);
      const reciprocal = state.visibleDirectedLinks.some(
        (candidate) =>
          candidate.sourceId === link.targetId && candidate.targetId === link.sourceId,
      );
      const dx = targetPoint.x - sourcePoint.x;
      const dy = targetPoint.y - sourcePoint.y;
      const distance = Math.hypot(dx, dy) || 0.0001;
      const nx = -dy / distance;
      const ny = dx / distance;
      const offset = reciprocal ? 4 : 0;
      const start = {
        x: sourcePoint.x + nx * offset,
        y: sourcePoint.y + ny * offset,
      };
      const end = {
        x: targetPoint.x + nx * offset,
        y: targetPoint.y + ny * offset,
      };

      const emphasis = Math.max(getNodeEmphasis(link.sourceId), getNodeEmphasis(link.targetId));
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.lineWidth = 0.8 + state.settings.linkThickness * 0.6;
      context.strokeStyle = withAlpha("#8da0c2", 0.2 + emphasis * 0.45);
      context.stroke();
      drawArrow(start, end, "#9ab3ff", 0.26 + emphasis * 0.52);
    }
  } else {
    for (const link of state.visibleDisplayLinks) {
      const source = getVisibleNodeById(link.sourceId);
      const target = getVisibleNodeById(link.targetId);
      if (!source || !target) {
        continue;
      }

      const sourcePoint = worldToScreen(source.x, source.y);
      const targetPoint = worldToScreen(target.x, target.y);
      const emphasis = Math.max(getNodeEmphasis(source.id), getNodeEmphasis(target.id));

      context.beginPath();
      context.moveTo(sourcePoint.x, sourcePoint.y);
      context.lineTo(targetPoint.x, targetPoint.y);
      context.lineWidth = 0.9 + state.settings.linkThickness * 0.75;
      context.strokeStyle = withAlpha("#8da0c2", 0.14 + emphasis * 0.38);
      context.stroke();
    }
  }

  const orderedNodes = [...state.visibleNodes].sort((left, right) => left.radiusBase - right.radiusBase);
  for (const node of orderedNodes) {
    const point = worldToScreen(node.x, node.y);
    const emphasis = getNodeEmphasis(node.id);
    const selected = node.id === state.selectedId;
    const hovered = node.id === state.hoveredId;
    const radius = node.radiusBase * state.camera.scale * (selected ? 1.12 : hovered ? 1.08 : 1);
    const nodeColor = withAlpha(node.color, 0.55 + emphasis * 0.45);

    context.beginPath();
    context.arc(point.x, point.y, radius + 6, 0, Math.PI * 2);
    context.fillStyle = withAlpha(node.color, selected ? 0.12 : hovered ? 0.08 : 0.03);
    context.fill();

    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = nodeColor;
    context.fill();

    context.lineWidth = selected ? 1.7 : 1;
    context.strokeStyle = selected ? "rgba(255,255,255,0.82)" : withAlpha("#0c0f13", 0.84);
    context.stroke();

    const labelVisibility = Math.max(
      0,
      Math.min(
        1,
        (state.camera.scale - state.settings.textFadeThreshold + (selected || hovered ? 0.4 : 0)) / 0.45,
      ),
    );

    if (labelVisibility > 0.03) {
      context.fillStyle = `rgba(215, 220, 229, ${labelVisibility * emphasis})`;
      context.font = selected ? "600 12px Inter, sans-serif" : "500 11px Inter, sans-serif";
      context.textBaseline = "middle";
      context.fillText(node.label, point.x + radius + 8, point.y);
    }
  }
}

function animationFrame() {
  runSimulation();
  drawGraph();
  window.requestAnimationFrame(animationFrame);
}

function renderNoteList() {
  const query = state.searchValue.trim().toLowerCase();
  const notes = state.notes.filter((note) => {
    if (!query) {
      return true;
    }
    return normalizedIncludes(note.title, query) || normalizedIncludes(note.body, query);
  });

  if (!notes.length) {
    noteList.innerHTML =
      '<div class="empty-state">No files match the current filter. Clear the search or create a new file.</div>';
    return;
  }

  noteList.innerHTML = notes
    .map((note) => {
      const linkCount = parseLinks(note.body).length;
      const activeClass = note.title === state.selectedId ? "active" : "";
      return `
        <button class="file-item ${activeClass}" data-note-title="${escapeHtml(note.title)}" type="button">
          <span class="file-icon" aria-hidden="true"></span>
          <span class="file-item-body">
            <span class="file-title">${escapeHtml(note.title)}</span>
            <span class="file-meta">${linkCount} outgoing links</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderEditor() {
  const selectedNote = getSelectedNote();
  const selectedNode = getNodeById(state.selectedId);

  if (!state.selectedId) {
    editorTitleLabel.textContent = "No selection";
    titleInput.value = "";
    bodyInput.value = "";
    titleInput.disabled = true;
    bodyInput.disabled = true;
    createMissingNoteButton.classList.add("hidden");
    selectionChip.textContent = "No file selected";
    editorHelp.textContent =
      "Select a file or unresolved node to inspect how links change the graph.";
    return;
  }

  editorTitleLabel.textContent = state.selectedId;
  const inbound = selectedNode ? selectedNode.inboundCount : 0;
  const total = selectedNode ? selectedNode.totalConnections : 0;
  selectionChip.textContent = `${state.selectedId} · ${inbound} backlinks · ${total} connections`;

  if (selectedNote) {
    titleInput.disabled = false;
    bodyInput.disabled = false;
    titleInput.value = selectedNote.title;
    bodyInput.value = selectedNote.body;
    createMissingNoteButton.classList.add("hidden");
    editorHelp.textContent =
      "Wiki links update the graph immediately. Placeholder targets appear even before their files exist.";
    return;
  }

  titleInput.disabled = true;
  bodyInput.disabled = true;
  titleInput.value = selectedNode ? selectedNode.id : "";
  bodyInput.value = "";
  createMissingNoteButton.classList.remove("hidden");
  editorHelp.textContent =
    "This unresolved node exists because another file linked to it. Create the file to convert it into a regular node.";
}

function renderGroupList() {
  if (!state.settings.groups.length) {
    groupList.innerHTML = '<div class="empty-state">No groups yet. Add one to color matching files.</div>';
    return;
  }

  groupList.innerHTML = state.settings.groups
    .map(
      (group) => `
        <div class="group-row" data-group-id="${group.id}">
          <input class="group-color" type="color" value="${group.color}" aria-label="Group color" />
          <input type="text" value="${escapeHtml(group.query)}" placeholder="Search term" />
          <button class="group-remove" type="button" aria-label="Remove group">×</button>
        </div>
      `,
    )
    .join("");
}

function updateGraphStats() {
  const documents = state.visibleNodes.filter((node) => node.hasDocument).length;
  const unresolved = state.visibleNodes.length - documents;
  graphStats.textContent = `${documents} files · ${state.visibleDirectedLinks.length} links · ${unresolved} unresolved`;
}

function renderSettingsValues() {
  textFadeInput.value = String(state.settings.textFadeThreshold);
  textFadeValue.textContent = state.settings.textFadeThreshold.toFixed(2);
  nodeSizeInput.value = String(state.settings.nodeSize);
  nodeSizeValue.textContent = state.settings.nodeSize.toFixed(2);
  linkThicknessInput.value = String(state.settings.linkThickness);
  linkThicknessValue.textContent = state.settings.linkThickness.toFixed(2);
  centerForceInput.value = String(state.settings.centerForce);
  centerForceValue.textContent = state.settings.centerForce.toFixed(2);
  repelForceInput.value = String(state.settings.repelForce);
  repelForceValue.textContent = state.settings.repelForce.toFixed(2);
  linkForceInput.value = String(state.settings.linkForce);
  linkForceValue.textContent = state.settings.linkForce.toFixed(2);
  linkDistanceInput.value = String(state.settings.linkDistance);
  linkDistanceValue.textContent = String(state.settings.linkDistance);

  filterSearchInput.value = state.settings.fileSearch;
  existingFilesToggle.checked = state.settings.existingFilesOnly;
  orphansToggle.checked = state.settings.showOrphans;
  arrowsToggle.checked = state.settings.showArrows;
  animateToggle.checked = state.settings.animate;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function syncUi() {
  buildGraph();
  renderNoteList();
  renderEditor();
  renderGroupList();
  renderSettingsValues();
  updateGraphStats();
}

function refreshGraph() {
  buildGraph();
  renderEditor();
  updateGraphStats();
}

function selectNode(nodeId) {
  state.selectedId = nodeId;
  renderNoteList();
  renderEditor();
}

function createNote(title, body = "") {
  const finalTitle = uniqueTitle(title);
  state.notes.unshift({ title: finalTitle, body });
  state.selectedId = finalTitle;
  syncUi();
}

function resetLayout() {
  state.allNodes = [];
  buildGraph();
}

function focusSelection() {
  const node = getNodeById(state.selectedId);
  if (!node) {
    return;
  }

  const bounds = canvas.getBoundingClientRect();
  state.camera.x = bounds.width / 2 - node.x * state.camera.scale;
  state.camera.y = bounds.height / 2 - node.y * state.camera.scale;
}

function findVisibleNodeAtPosition(clientX, clientY) {
  const bounds = canvas.getBoundingClientRect();
  const screenX = clientX - bounds.left;
  const screenY = clientY - bounds.top;
  let hit = null;

  for (const node of state.visibleNodes) {
    const point = worldToScreen(node.x, node.y);
    const radius = (node.radiusBase + 6) * state.camera.scale;
    if (Math.hypot(point.x - screenX, point.y - screenY) <= radius) {
      hit = node;
    }
  }
  return hit;
}

searchInput.addEventListener("input", (event) => {
  state.searchValue = event.target.value;
  renderNoteList();
});

filterSearchInput.addEventListener("input", (event) => {
  state.settings.fileSearch = event.target.value;
  refreshGraph();
});

existingFilesToggle.addEventListener("change", (event) => {
  state.settings.existingFilesOnly = event.target.checked;
  refreshGraph();
});

orphansToggle.addEventListener("change", (event) => {
  state.settings.showOrphans = event.target.checked;
  refreshGraph();
});

arrowsToggle.addEventListener("change", (event) => {
  state.settings.showArrows = event.target.checked;
});

animateToggle.addEventListener("change", (event) => {
  state.settings.animate = event.target.checked;
});

textFadeInput.addEventListener("input", (event) => {
  state.settings.textFadeThreshold = Number(event.target.value);
  textFadeValue.textContent = state.settings.textFadeThreshold.toFixed(2);
});

nodeSizeInput.addEventListener("input", (event) => {
  state.settings.nodeSize = Number(event.target.value);
  nodeSizeValue.textContent = state.settings.nodeSize.toFixed(2);
  refreshGraph();
});

linkThicknessInput.addEventListener("input", (event) => {
  state.settings.linkThickness = Number(event.target.value);
  linkThicknessValue.textContent = state.settings.linkThickness.toFixed(2);
});

centerForceInput.addEventListener("input", (event) => {
  state.settings.centerForce = Number(event.target.value);
  centerForceValue.textContent = state.settings.centerForce.toFixed(2);
});

repelForceInput.addEventListener("input", (event) => {
  state.settings.repelForce = Number(event.target.value);
  repelForceValue.textContent = state.settings.repelForce.toFixed(2);
});

linkForceInput.addEventListener("input", (event) => {
  state.settings.linkForce = Number(event.target.value);
  linkForceValue.textContent = state.settings.linkForce.toFixed(2);
});

linkDistanceInput.addEventListener("input", (event) => {
  state.settings.linkDistance = Number(event.target.value);
  linkDistanceValue.textContent = String(state.settings.linkDistance);
});

titleInput.addEventListener("change", (event) => {
  const selectedNote = getSelectedNote();
  if (!selectedNote) {
    return;
  }

  const nextTitle = uniqueTitle(event.target.value, selectedNote.title);
  const previousTitle = selectedNote.title;
  selectedNote.title = nextTitle;

  for (const note of state.notes) {
    note.body = note.body.replaceAll(`[[${previousTitle}]]`, `[[${nextTitle}]]`);
  }

  if (state.selectedId === previousTitle) {
    state.selectedId = nextTitle;
  }

  syncUi();
});

bodyInput.addEventListener("input", (event) => {
  const selectedNote = getSelectedNote();
  if (!selectedNote) {
    return;
  }

  selectedNote.body = event.target.value;
  refreshGraph();
});

noteList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-note-title]");
  if (!button) {
    return;
  }

  selectNode(button.dataset.noteTitle);
  focusSelection();
});

addNoteButton.addEventListener("click", () => {
  createNote("Untitled", "Link this file to [[Graph View]] or [[Visual Tuning]].");
});

createMissingNoteButton.addEventListener("click", () => {
  if (!state.selectedId || hasDocument(state.selectedId)) {
    return;
  }

  createNote(state.selectedId, `Created from unresolved graph node [[${state.selectedId}]].`);
});

centerSelectionButton.addEventListener("click", () => {
  focusSelection();
});

resetLayoutButton.addEventListener("click", () => {
  resetLayout();
  focusSelection();
});

addGroupButton.addEventListener("click", () => {
  const color = GROUP_COLORS[state.settings.groups.length % GROUP_COLORS.length];
  state.settings.groups.push({
    id: crypto.randomUUID(),
    query: "",
    color,
  });
  syncUi();
});

groupList.addEventListener("input", (event) => {
  const row = event.target.closest("[data-group-id]");
  if (!row) {
    return;
  }

  const group = state.settings.groups.find((item) => item.id === row.dataset.groupId);
  if (!group) {
    return;
  }

  if (event.target.matches(".group-color")) {
    group.color = event.target.value;
  } else {
    group.query = event.target.value;
  }

  refreshGraph();
});

groupList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-group-id]");
  if (!row || !event.target.closest(".group-remove")) {
    return;
  }

  state.settings.groups = state.settings.groups.filter((group) => group.id !== row.dataset.groupId);
  syncUi();
});

canvas.addEventListener("pointerdown", (event) => {
  const hitNode = findVisibleNodeAtPosition(event.clientX, event.clientY);

  if (hitNode) {
    const bounds = canvas.getBoundingClientRect();
    const worldPoint = screenToWorld(event.clientX - bounds.left, event.clientY - bounds.top);
    state.pointer.mode = "drag-node";
    state.pointer.nodeId = hitNode.id;
    state.pointer.offsetX = hitNode.x - worldPoint.x;
    state.pointer.offsetY = hitNode.y - worldPoint.y;
    selectNode(hitNode.id);
  } else {
    state.pointer.mode = "pan";
    state.pointer.originX = event.clientX;
    state.pointer.originY = event.clientY;
    state.pointer.cameraX = state.camera.x;
    state.pointer.cameraY = state.camera.y;
  }

  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  const bounds = canvas.getBoundingClientRect();

  if (state.pointer.mode === "drag-node" && state.pointer.nodeId) {
    const node = getNodeById(state.pointer.nodeId);
    if (!node) {
      return;
    }

    const worldPoint = screenToWorld(event.clientX - bounds.left, event.clientY - bounds.top);
    node.x = worldPoint.x + state.pointer.offsetX;
    node.y = worldPoint.y + state.pointer.offsetY;
    node.vx = 0;
    node.vy = 0;
    return;
  }

  if (state.pointer.mode === "pan") {
    state.camera.x = state.pointer.cameraX + (event.clientX - state.pointer.originX);
    state.camera.y = state.pointer.cameraY + (event.clientY - state.pointer.originY);
    return;
  }

  const hoveredNode = findVisibleNodeAtPosition(event.clientX, event.clientY);
  state.hoveredId = hoveredNode ? hoveredNode.id : null;
});

canvas.addEventListener("pointerup", () => {
  state.pointer.mode = "idle";
  state.pointer.nodeId = null;
});

canvas.addEventListener("pointerleave", () => {
  if (state.pointer.mode === "idle") {
    state.hoveredId = null;
  }
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();

    const bounds = canvas.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const worldBefore = screenToWorld(pointerX, pointerY);
    const delta = event.deltaY < 0 ? 1.08 : 0.92;
    state.camera.scale = Math.max(0.42, Math.min(2.8, state.camera.scale * delta));
    state.camera.x = pointerX - worldBefore.x * state.camera.scale;
    state.camera.y = pointerY - worldBefore.y * state.camera.scale;
  },
  { passive: false },
);

window.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName || "";
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") {
    return;
  }

  const panStep = event.shiftKey ? 60 : 24;
  if (event.key === "+") {
    state.camera.scale = Math.min(2.8, state.camera.scale * 1.08);
  } else if (event.key === "-") {
    state.camera.scale = Math.max(0.42, state.camera.scale * 0.92);
  } else if (event.key === "ArrowLeft") {
    state.camera.x += panStep;
  } else if (event.key === "ArrowRight") {
    state.camera.x -= panStep;
  } else if (event.key === "ArrowUp") {
    state.camera.y += panStep;
  } else if (event.key === "ArrowDown") {
    state.camera.y -= panStep;
  }
});

window.addEventListener("resize", () => {
  setCanvasSize();
  focusSelection();
});

syncUi();
setCanvasSize();
focusSelection();
animationFrame();
