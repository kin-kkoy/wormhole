import type {
  MarkdownDocument,
  MarkdownGraphEdge,
  MarkdownGraphGroup,
  MarkdownGraphModel,
  MarkdownGraphNode,
  MarkdownGraphSettings,
} from "./types";

const WIKI_LINK_PATTERN = /\[\[([^[\]]+)\]\]/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;
const DEFAULT_COLORS = ["#7d8dff", "#54bfa7", "#d39f50", "#c272f2", "#5d9ef5"];

type ParsedReference = {
  raw: string;
  label: string;
  resolvedPath: string | null;
};

export const DEFAULT_GRAPH_SETTINGS: MarkdownGraphSettings = {
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
  groups: [],
};

export function createDefaultGraphSettings(
  partial?: Partial<MarkdownGraphSettings>,
): MarkdownGraphSettings {
  return {
    ...DEFAULT_GRAPH_SETTINGS,
    ...partial,
    groups: partial?.groups ? [...partial.groups] : [...DEFAULT_GRAPH_SETTINGS.groups],
  };
}

export function createGraphGroup(query = "", color?: string): MarkdownGraphGroup {
  return {
    id: createGroupId(),
    query,
    color: color ?? DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
  };
}

export function buildMarkdownGraphModel(
  documents: MarkdownDocument[],
  settings: MarkdownGraphSettings,
): MarkdownGraphModel {
  const normalizedDocuments = documents.map((document) => normalizeDocument(document));
  const documentsByPath = new Map(normalizedDocuments.map((document) => [document.path, document]));
  const aliasMap = createAliasMap(normalizedDocuments);
  const nodeMap = new Map<string, MarkdownGraphNode>();
  const directedEdges = new Map<string, MarkdownGraphEdge>();

  function ensureDocumentNode(document: MarkdownDocument) {
    if (!nodeMap.has(document.path)) {
      nodeMap.set(document.path, {
        id: document.path,
        label: deriveDocumentLabel(document),
        sourcePath: document.path,
        hasDocument: true,
        aliases: [...(document.aliases ?? [])],
        inboundCount: 0,
        outgoingCount: 0,
        totalConnections: 0,
        radiusBase: 4.8,
        color: "#6b8eea",
        createdAt: toTimestamp(document.createdAt),
      });
    }
    return nodeMap.get(document.path)!;
  }

  function ensureMissingNode(label: string) {
    const key = `missing:${normalizeLookup(label)}`;
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        id: key,
        label,
        sourcePath: null,
        hasDocument: false,
        aliases: [],
        inboundCount: 0,
        outgoingCount: 0,
        totalConnections: 0,
        radiusBase: 3.4,
        color: "#7c838f",
        createdAt: null,
      });
    }
    return nodeMap.get(key)!;
  }

  for (const document of normalizedDocuments) {
    ensureDocumentNode(document);
  }

  for (const document of normalizedDocuments) {
    const source = ensureDocumentNode(document);
    for (const reference of parseDocumentReferences(document, aliasMap)) {
      const target = reference.resolvedPath
        ? ensureDocumentNode(documentsByPath.get(reference.resolvedPath)!)
        : ensureMissingNode(reference.label);

      if (target.id === source.id) {
        continue;
      }

      const edgeId = `${source.id}-->${target.id}`;
      if (!directedEdges.has(edgeId)) {
        directedEdges.set(edgeId, {
          id: edgeId,
          sourceId: source.id,
          targetId: target.id,
          reciprocal: false,
          directed: true,
        });
      }
    }
  }

  for (const edge of directedEdges.values()) {
    const source = nodeMap.get(edge.sourceId);
    const target = nodeMap.get(edge.targetId);
    if (!source || !target) {
      continue;
    }

    source.outgoingCount += 1;
    source.totalConnections += 1;
    target.inboundCount += 1;
    target.totalConnections += 1;
  }

  for (const node of nodeMap.values()) {
    const color = getGroupColor(node, settings.groups, documentsByPath);
    const backlinkBoost = Math.sqrt(node.inboundCount) * 2.6 * settings.nodeSize;
    node.radiusBase = (node.hasDocument ? 4.8 : 3.4) + backlinkBoost;
    node.color = color;
  }

  const nodes = Array.from(nodeMap.values()).sort(sortNodes);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const visibleNodes = filterVisibleNodes(nodes, documentsByPath, settings);
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleDirectedEdges = Array.from(directedEdges.values()).filter(
    (edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId),
  );
  const visibleDisplayEdges = collapseDisplayEdges(visibleDirectedEdges);
  const neighborMap = buildNeighborMap(visibleDirectedEdges);

  return {
    nodes,
    nodesById,
    documentsByPath,
    visibleNodes,
    visibleDirectedEdges,
    visibleDisplayEdges,
    neighborMap,
  };
}

function filterVisibleNodes(
  nodes: MarkdownGraphNode[],
  documentsByPath: Map<string, MarkdownDocument>,
  settings: MarkdownGraphSettings,
) {
  const query = settings.fileSearch.trim().toLowerCase();
  const visibleBySearch = nodes.filter((node) => {
    if (settings.existingFilesOnly && !node.hasDocument) {
      return false;
    }

    if (!query) {
      return true;
    }

    const document = node.sourcePath ? documentsByPath.get(node.sourcePath) : null;
    return [
      node.label,
      node.id,
      ...(node.aliases ?? []),
      document?.content ?? "",
      ...(document?.tags ?? []),
    ].some((value) => value.toLowerCase().includes(query));
  });

  return settings.showOrphans
    ? visibleBySearch
    : visibleBySearch.filter((node) => node.totalConnections > 0);
}

function collapseDisplayEdges(edges: MarkdownGraphEdge[]) {
  const collapsed = new Map<string, MarkdownGraphEdge>();
  const directedIds = new Set(edges.map((edge) => edge.id));

  for (const edge of edges) {
    const pairId = [edge.sourceId, edge.targetId].sort().join("<->");
    if (collapsed.has(pairId)) {
      continue;
    }

    collapsed.set(pairId, {
      id: pairId,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      directed: false,
      reciprocal: directedIds.has(`${edge.targetId}-->${edge.sourceId}`),
    });
  }

  return Array.from(collapsed.values());
}

function buildNeighborMap(edges: MarkdownGraphEdge[]) {
  const neighborMap = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!neighborMap.has(edge.sourceId)) {
      neighborMap.set(edge.sourceId, new Set());
    }
    if (!neighborMap.has(edge.targetId)) {
      neighborMap.set(edge.targetId, new Set());
    }
    neighborMap.get(edge.sourceId)!.add(edge.targetId);
    neighborMap.get(edge.targetId)!.add(edge.sourceId);
  }
  return neighborMap;
}

function parseDocumentReferences(
  document: MarkdownDocument,
  aliasMap: Map<string, string>,
): ParsedReference[] {
  const references: ParsedReference[] = [];

  for (const match of document.content.matchAll(WIKI_LINK_PATTERN)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }

    const label = sanitizeWikiTarget(raw);
    const resolvedPath = resolveWikiReference(label, aliasMap);
    references.push({ raw, label, resolvedPath });
  }

  for (const match of document.content.matchAll(MARKDOWN_LINK_PATTERN)) {
    const href = match[2]?.trim();
    if (!href || isExternalHref(href)) {
      continue;
    }

    const resolvedPath = resolveMarkdownHref(document.path, href);
    if (!resolvedPath) {
      continue;
    }

    const label = stripMarkdownExtension(lastSegment(resolvedPath));
    references.push({
      raw: href,
      label,
      resolvedPath: aliasMap.get(normalizeLookup(resolvedPath)) ?? resolvedPath,
    });
  }

  return dedupeReferences(references);
}

function dedupeReferences(references: ParsedReference[]) {
  const deduped = new Map<string, ParsedReference>();
  for (const reference of references) {
    const key = reference.resolvedPath ?? `missing:${normalizeLookup(reference.label)}`;
    if (!deduped.has(key)) {
      deduped.set(key, reference);
    }
  }
  return Array.from(deduped.values());
}

function createAliasMap(documents: MarkdownDocument[]) {
  const aliasMap = new Map<string, string>();

  for (const document of documents) {
    const label = deriveDocumentLabel(document);
    const aliases = new Set<string>([
      document.path,
      stripMarkdownExtension(document.path),
      label,
      stripMarkdownExtension(lastSegment(document.path)),
      ...(document.aliases ?? []),
    ]);

    for (const alias of aliases) {
      const key = normalizeLookup(alias);
      if (key && !aliasMap.has(key)) {
        aliasMap.set(key, document.path);
      }
    }
  }

  return aliasMap;
}

function resolveWikiReference(value: string, aliasMap: Map<string, string>) {
  return aliasMap.get(normalizeLookup(value)) ?? null;
}

function resolveMarkdownHref(sourcePath: string, href: string) {
  const cleaned = safeDecode(href.split("#")[0] ?? "");
  if (!cleaned) {
    return null;
  }

  if (cleaned.startsWith("/")) {
    return normalizePath(cleaned.replace(/^\//, ""));
  }

  if (!cleaned.endsWith(".md")) {
    return null;
  }

  return normalizePath(`${dirname(sourcePath)}/${cleaned}`);
}

function normalizeDocument(document: MarkdownDocument): MarkdownDocument {
  return {
    ...document,
    path: normalizePath(document.path),
    aliases: document.aliases?.map((alias) => alias.trim()).filter(Boolean) ?? [],
  };
}

function deriveDocumentLabel(document: MarkdownDocument) {
  return document.title?.trim() || stripMarkdownExtension(lastSegment(document.path));
}

function sanitizeWikiTarget(value: string) {
  return value.split("|")[0].split("#")[0].split("^")[0].trim();
}

function getGroupColor(
  node: MarkdownGraphNode,
  groups: MarkdownGraphGroup[],
  documentsByPath: Map<string, MarkdownDocument>,
) {
  const document = node.sourcePath ? documentsByPath.get(node.sourcePath) : null;
  const haystacks = [
    node.label,
    node.sourcePath ?? "",
    ...(node.aliases ?? []),
    document?.content ?? "",
    ...(document?.tags ?? []),
  ];

  for (const group of groups) {
    const query = group.query.trim().toLowerCase();
    if (!query) {
      continue;
    }

    if (haystacks.some((value) => value.toLowerCase().includes(query))) {
      return group.color;
    }
  }

  return node.hasDocument ? "#6b8eea" : "#7c838f";
}

function sortNodes(left: MarkdownGraphNode, right: MarkdownGraphNode) {
  if (left.hasDocument !== right.hasDocument) {
    return Number(right.hasDocument) - Number(left.hasDocument);
  }

  if ((right.createdAt ?? 0) !== (left.createdAt ?? 0)) {
    return (right.createdAt ?? 0) - (left.createdAt ?? 0);
  }

  return left.label.localeCompare(right.label);
}

function isExternalHref(href: string) {
  return /^(https?:|mailto:|obsidian:|file:|#)/i.test(href);
}

function normalizeLookup(value: string) {
  return stripMarkdownExtension(normalizePath(value))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePath(value: string) {
  const segments = value.replace(/\\/g, "/").split("/");
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }

  return normalized.join("/");
}

function dirname(value: string) {
  const normalized = normalizePath(value);
  const segments = normalized.split("/");
  segments.pop();
  return segments.join("/");
}

function lastSegment(value: string) {
  const normalized = normalizePath(value);
  const segments = normalized.split("/");
  return segments[segments.length - 1] || normalized;
}

function stripMarkdownExtension(value: string) {
  return value.replace(/\.md$/i, "");
}

function toTimestamp(value: MarkdownDocument["createdAt"]) {
  if (!value) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function createGroupId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `group-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}
