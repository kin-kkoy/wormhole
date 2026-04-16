import type { CSSProperties } from "react";

export type MarkdownDocument = {
  path: string;
  content: string;
  title?: string;
  aliases?: string[];
  createdAt?: string | number | Date | null;
  updatedAt?: string | number | Date | null;
  tags?: string[];
};

export type MarkdownGraphGroup = {
  id: string;
  query: string;
  color: string;
};

export type MarkdownGraphSettings = {
  fileSearch: string;
  existingFilesOnly: boolean;
  showOrphans: boolean;
  showArrows: boolean;
  animate: boolean;
  textFadeThreshold: number;
  nodeSize: number;
  linkThickness: number;
  centerForce: number;
  repelForce: number;
  linkForce: number;
  linkDistance: number;
  groups: MarkdownGraphGroup[];
};

export type MarkdownGraphNode = {
  id: string;
  label: string;
  sourcePath: string | null;
  hasDocument: boolean;
  aliases: string[];
  inboundCount: number;
  outgoingCount: number;
  totalConnections: number;
  radiusBase: number;
  color: string;
  createdAt: number | null;
};

export type MarkdownGraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  reciprocal: boolean;
  directed: boolean;
};

export type MarkdownGraphModel = {
  nodes: MarkdownGraphNode[];
  nodesById: Map<string, MarkdownGraphNode>;
  documentsByPath: Map<string, MarkdownDocument>;
  visibleNodes: MarkdownGraphNode[];
  visibleDirectedEdges: MarkdownGraphEdge[];
  visibleDisplayEdges: MarkdownGraphEdge[];
  neighborMap: Map<string, Set<string>>;
};

export type MarkdownGraphSelection = {
  node: MarkdownGraphNode;
  document: MarkdownDocument | null;
};

export type MarkdownGraphViewProps = {
  documents: MarkdownDocument[];
  selectedNodeId?: string | null;
  initialSettings?: Partial<MarkdownGraphSettings>;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  onSelectNode?: (selection: MarkdownGraphSelection) => void;
  onCreateUnresolved?: (payload: { id: string; label: string }) => void;
};
