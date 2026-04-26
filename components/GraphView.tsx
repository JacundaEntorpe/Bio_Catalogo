"use client";

import dynamic from "next/dynamic";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import type { CategoryGraphEdge, CategoryGraphNode } from "@/lib/category-graph";

const ForceGraph2D: any = dynamic(() => import("react-force-graph-2d"), {
  ssr: false
});

type GraphViewProps = {
  nodes: CategoryGraphNode[];
  edges: CategoryGraphEdge[];
  selectedNodeId?: string | null;
  currentEntryId?: string | null;
  onNodeSelect: (nodeId: string) => void;
  onEntrySelect?: (entryId: string) => void;
  isVisible?: boolean;
};

export type GraphViewHandle = {
  focusNode: (nodeId: string) => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type GraphLink = CategoryGraphEdge & {
  id: string;
};

type GraphLinkRef = string | { id: string };

type LargeGraphProfile = {
  cooldownTicks: number;
  alphaDecay: number;
  velocityDecay: number;
  chargeStrength: number;
  linkDistance: number;
  linkStrength: number;
  labelZoomThreshold: number;
  prominentLabelLimit: number;
  entryLabelZoomThreshold: number;
  resetPadding: number;
  showDirectionalParticles: boolean;
  reduceVisualEffects: boolean;
  pointerRadius: {
    category: number;
    entry: number;
  };
};

const graphBackground = "#0f1614";

function edgeKey(sourceId: string, targetId: string) {
  return `${sourceId}->${targetId}`;
}

function resolveLinkRefId(linkRef: GraphLinkRef) {
  return typeof linkRef === "string" ? linkRef : linkRef.id;
}

export const GraphView = forwardRef<GraphViewHandle, GraphViewProps>(function GraphView(
  { currentEntryId, edges, nodes, onEntrySelect, onNodeSelect, selectedNodeId, isVisible = true },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 920, height: 620 });

  const graphNodes = useMemo(() => {
    const persistedNodes = (graphRef.current?.graphData?.().nodes as CategoryGraphNode[] | undefined) ?? [];
    const persistedNodeById = new Map(persistedNodes.map((node) => [node.id, node]));

    return nodes.map((node) => {
      const persistedNode = persistedNodeById.get(node.id);

      if (!persistedNode) {
        return { ...node };
      }

      return {
        ...node,
        fx: persistedNode.fx,
        fy: persistedNode.fy,
        x: persistedNode.x,
        y: persistedNode.y
      };
    });
  }, [nodes]);
  const graphLinks = useMemo<GraphLink[]>(
    () => edges.map((edge) => ({ ...edge, id: edgeKey(edge.source, edge.target) })),
    [edges]
  );
  const nodeById = useMemo(() => new Map(graphNodes.map((node) => [node.id, node])), [graphNodes]);
  const parentByNodeId = useMemo(() => new Map(nodes.map((node) => [node.id, node.parentId])), [nodes]);
  const childCategoryIdsByParentId = useMemo(() => {
    const childIdsByParent = new Map<string, string[]>();

    for (const node of nodes) {
      if (node.kind !== "category" || !node.parentId) {
        continue;
      }

      const childIds = childIdsByParent.get(node.parentId) ?? [];
      childIds.push(node.id);
      childIdsByParent.set(node.parentId, childIds);
    }

    return childIdsByParent;
  }, [nodes]);
  const graphData = useMemo(() => ({ links: graphLinks, nodes: graphNodes }), [graphLinks, graphNodes]);
  const largeGraphProfile = useMemo<LargeGraphProfile>(() => {
    const nodeCount = graphNodes.length;

    if (nodeCount > 1800) {
      return {
        alphaDecay: 0.055,
        chargeStrength: -105,
        cooldownTicks: 90,
        entryLabelZoomThreshold: 3.9,
        labelZoomThreshold: 3.2,
        linkDistance: 18,
        linkStrength: 0.42,
        pointerRadius: {
          category: 12,
          entry: 10
        },
        prominentLabelLimit: 2,
        reduceVisualEffects: true,
        resetPadding: 160,
        showDirectionalParticles: false,
        velocityDecay: 0.42
      };
    }

    if (nodeCount > 900) {
      return {
        alphaDecay: 0.042,
        chargeStrength: -135,
        cooldownTicks: 120,
        entryLabelZoomThreshold: 3.35,
        labelZoomThreshold: 2.75,
        linkDistance: 26,
        linkStrength: 0.5,
        pointerRadius: {
          category: 13,
          entry: 11
        },
        prominentLabelLimit: 3,
        reduceVisualEffects: true,
        resetPadding: 140,
        showDirectionalParticles: false,
        velocityDecay: 0.38
      };
    }

    if (nodeCount > 320) {
      return {
        alphaDecay: 0.03,
        chargeStrength: -185,
        cooldownTicks: 170,
        entryLabelZoomThreshold: 2.8,
        labelZoomThreshold: 2.25,
        linkDistance: 46,
        linkStrength: 0.68,
        pointerRadius: {
          category: 14,
          entry: 11
        },
        prominentLabelLimit: 5,
        reduceVisualEffects: false,
        resetPadding: 120,
        showDirectionalParticles: false,
        velocityDecay: 0.32
      };
    }

    return {
      alphaDecay: 0.04,
      chargeStrength: graphNodes.length > 60 ? -205 : -165,
      cooldownTicks: graphNodes.length > 60 ? 210 : 150,
      entryLabelZoomThreshold: 1.3,
      labelZoomThreshold: graphNodes.length > 60 ? 2.05 : 1.55,
      linkDistance: graphNodes.length > 60 ? 52 : 74,
      linkStrength: graphNodes.length > 60 ? 0.72 : 0.9,
      pointerRadius: {
        category: 15,
        entry: 12
      },
      prominentLabelLimit: graphNodes.length > 45 ? 8 : 18,
      reduceVisualEffects: false,
      resetPadding: graphNodes.length > 80 ? 120 : 80,
      showDirectionalParticles: true,
      velocityDecay: graphNodes.length > 60 ? 0.3 : 0.26
    };
  }, [graphNodes.length]);
  const linkRelationById = useMemo(() => {
    const relationById = new Map<string, CategoryGraphNode["entryRelation"]>();

    for (const link of graphLinks) {
      const targetNode = nodeById.get(link.target);
      relationById.set(link.id, targetNode?.kind === "entry" ? targetNode.entryRelation : undefined);
    }

    return relationById;
  }, [graphLinks, nodeById]);
  const prominentNodeIds = useMemo(() => {
    return new Set(
      [...graphNodes]
        .sort((left, right) => {
          const weightDifference = (right.childCount ?? 0) + (right.entryCount ?? 0) - ((left.childCount ?? 0) + (left.entryCount ?? 0));
          if (weightDifference !== 0) {
            return weightDifference;
          }

          return left.name.localeCompare(right.name);
        })
        .slice(0, largeGraphProfile.prominentLabelLimit)
        .map((node) => node.id)
    );
  }, [graphNodes, largeGraphProfile.prominentLabelLimit]);

  const highlightedNodeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const ids = new Set<string>();
    let currentNodeId: string | null | undefined = selectedNodeId;

    while (currentNodeId) {
      ids.add(currentNodeId);
      currentNodeId = parentByNodeId.get(currentNodeId);
    }

    return ids;
  }, [parentByNodeId, selectedNodeId]);

  const highlightedEdgeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const ids = new Set<string>();
    let currentNodeId: string | null | undefined = selectedNodeId;

    while (currentNodeId) {
      const parentId = parentByNodeId.get(currentNodeId);
      if (!parentId) {
        break;
      }

      ids.add(edgeKey(parentId, currentNodeId));
      currentNodeId = parentId;
    }

    return ids;
  }, [parentByNodeId, selectedNodeId]);

  const highlightedDescendantNodeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const ids = new Set<string>();
    const queue = [...(childCategoryIdsByParentId.get(selectedNodeId) ?? [])];

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId || ids.has(nodeId)) {
        continue;
      }

      ids.add(nodeId);
      queue.push(...(childCategoryIdsByParentId.get(nodeId) ?? []));
    }

    return ids;
  }, [childCategoryIdsByParentId, selectedNodeId]);

  const highlightedDescendantEdgeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const ids = new Set<string>();

    for (const nodeId of highlightedDescendantNodeIds) {
      const parentId = parentByNodeId.get(nodeId);
      if (parentId) {
        ids.add(edgeKey(parentId, nodeId));
      }
    }

    return ids;
  }, [highlightedDescendantNodeIds, parentByNodeId, selectedNodeId]);

  const focusNodeById = useCallback((nodeId: string, zoomLevel = 2.1) => {
    const targetNode = nodeById.get(nodeId);
    if (!targetNode || typeof targetNode.x !== "number" || typeof targetNode.y !== "number") {
      return;
    }

    graphRef.current?.centerAt(targetNode.x, targetNode.y, 600);
    graphRef.current?.zoom(zoomLevel, 600);
  }, [nodeById]);

  const resetView = useCallback(() => {
    graphRef.current?.zoomToFit(700, largeGraphProfile.resetPadding);
  }, [largeGraphProfile.resetPadding]);

  const zoomBy = useCallback((multiplier: number) => {
    const currentZoom = Number(graphRef.current?.zoom?.() ?? 1);
    const nextZoom = Math.min(Math.max(currentZoom * multiplier, 0.45), 8);
    graphRef.current?.zoom(nextZoom, 250);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focusNode: (nodeId: string) => {
        focusNodeById(nodeId);
      },
      resetView,
      zoomIn: () => {
        zoomBy(1.22);
      },
      zoomOut: () => {
        zoomBy(0.82);
      }
    }),
    [focusNodeById, resetView, zoomBy]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setDimensions({
        width: entry.contentRect.width,
        height: Math.max(entry.contentRect.height, 540)
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!graphRef.current || graphNodes.length === 0) {
      return;
    }

    const chargeForce = graphRef.current.d3Force?.("charge");
    const linkForce = graphRef.current.d3Force?.("link");

    chargeForce?.strength?.(largeGraphProfile.chargeStrength);
    linkForce?.distance?.(largeGraphProfile.linkDistance);
    linkForce?.strength?.(largeGraphProfile.linkStrength);
    graphRef.current.d3ReheatSimulation?.();
  }, [graphLinks, graphNodes.length, largeGraphProfile]);

  useEffect(() => {
    if (!graphRef.current || graphNodes.length === 0 || !isVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      resetView();
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [graphLinks, graphNodes.length, isVisible, resetView]);

  useEffect(() => {
    if (!selectedNodeId || !isVisible) {
      return;
    }

    focusNodeById(selectedNodeId);
  }, [focusNodeById, graphNodes, isVisible, selectedNodeId]);

  return (
    <div className="graph-view" ref={containerRef}>
      <ForceGraph2D
        backgroundColor={graphBackground}
        cooldownTicks={largeGraphProfile.cooldownTicks}
        d3AlphaDecay={largeGraphProfile.alphaDecay}
        d3VelocityDecay={largeGraphProfile.velocityDecay}
        enableNodeDrag
        enablePanInteraction
        enablePointerInteraction
        enableZoomInteraction
        graphData={graphData}
        height={dimensions.height}
        linkColor={(link: GraphLink & { source: GraphLinkRef; target: GraphLinkRef }) => {
          const entryRelation = linkRelationById.get(link.id);

          if (highlightedEdgeIds.has(link.id)) {
            return "rgba(127, 221, 188, 0.92)";
          }

          if (highlightedDescendantEdgeIds.has(link.id)) {
            return selectedNodeId ? "rgba(181, 188, 49, 0.9)" : "rgba(181, 188, 49, 0.9)";
          }

          if (entryRelation === "direct") {
            return selectedNodeId ? "rgba(224, 188, 119, 0.52)" : "rgba(224, 188, 119, 0.32)";
          }

          if (entryRelation === "descendant") {
            return selectedNodeId ? "rgba(49, 125, 188, 0.9)" : "rgba(49, 125, 188, 0.9)";
          }

          if (selectedNodeId) {
            return "rgba(146, 159, 155, 0.12)";
          }

          return "rgba(146, 159, 155, 0.28)";
        }}
        linkDirectionalParticles={(link: GraphLink) =>
          largeGraphProfile.showDirectionalParticles && highlightedEdgeIds.has(link.id) ? 2 : 0
        }
        linkDirectionalParticleColor={() => "rgba(236, 244, 228, 0.86)"}
        linkDirectionalParticleSpeed={0.008}
        linkWidth={(link: GraphLink) => {
          if (highlightedEdgeIds.has(link.id)) {
            return 2.4;
          }

          if (highlightedDescendantEdgeIds.has(link.id)) {
            return 1.2;
          }

          return selectedNodeId ? 0.6 : 1;
        }}
        nodeCanvasObject={(node: CategoryGraphNode, context: CanvasRenderingContext2D, globalScale: number) => {
          const isSelected = node.id === selectedNodeId;
          const isInPath = highlightedNodeIds.has(node.id);
          const isDescendantCategory = node.kind === "category" && highlightedDescendantNodeIds.has(node.id);
          const hasSelection = Boolean(selectedNodeId);
          const isEntryNode = node.kind === "entry";
          const isCurrentEntry = isEntryNode && node.entryId === currentEntryId;
          const isDirectEntry = isEntryNode && node.entryRelation === "direct";
          const nodeWeight = isEntryNode ? 0 : Math.min(4, (node.childCount ?? 0) * 0.22 + (node.entryCount ?? 0) * 0.08);
          const radius = (isCurrentEntry ? 6.8 : isEntryNode ? 4.8 : isSelected ? 8 : isInPath ? 6 : isDescendantCategory ? 5.2 : 4) + nodeWeight;
          const fontSize = isCurrentEntry ? 11 : isEntryNode ? 10 : isSelected ? 14 : isInPath ? 12 : isDescendantCategory ? 11 : 10;
          const shouldDrawEntryLabel =
            isCurrentEntry ||
            graphNodes.length <= 240 ||
            globalScale > largeGraphProfile.entryLabelZoomThreshold;
          const shouldDrawLabel =
            (isEntryNode && shouldDrawEntryLabel) ||
            isSelected ||
            isInPath ||
            (isDescendantCategory && globalScale > largeGraphProfile.labelZoomThreshold + 0.25) ||
            globalScale > largeGraphProfile.labelZoomThreshold ||
            (!hasSelection && prominentNodeIds.has(node.id));

          context.save();

          if (isCurrentEntry) {
            context.beginPath();
            context.arc(node.x ?? 0, node.y ?? 0, radius + 5.5, 0, 2 * Math.PI, false);
            context.fillStyle = "rgba(244, 230, 183, 0.2)";
            context.shadowColor = "rgba(244, 230, 183, 0.32)";
            context.shadowBlur = largeGraphProfile.reduceVisualEffects ? 10 : 22;
            context.fill();
          }

          context.beginPath();
          context.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false);
          context.fillStyle = isSelected
            ? "#f4e6b7"
            : isCurrentEntry
              ? "#f6ddb2"
            : isEntryNode
              ? isDirectEntry
                ? "rgba(224, 188, 119, 0.95)"
                : "rgba(114, 168, 214, 0.95)"
            : isInPath
              ? "#7fddbc"
              : isDescendantCategory
                ? "rgba(106, 209, 151, 0.9)"
              : hasSelection
                ? "rgba(178, 194, 188, 0.22)"
                : "rgba(176, 209, 199, 0.86)";
          context.shadowColor = isSelected
            ? "#f4e6b7"
            : isCurrentEntry
              ? "rgba(246, 221, 178, 0.95)"
              : isEntryNode
                ? isDirectEntry
                  ? "rgba(224, 188, 119, 0.7)"
                  : "rgba(114, 168, 214, 0.72)"
                : isInPath
                  ? "#7fddbc"
                  : isDescendantCategory
                    ? "rgba(106, 171, 209, 0.42)"
                  : "transparent";
          context.shadowBlur =
            largeGraphProfile.reduceVisualEffects && !isSelected && !isCurrentEntry
              ? 0
              : isSelected || isInPath || isEntryNode || isCurrentEntry
                ? 18
                : isDescendantCategory
                  ? 10
                : 0;
          context.fill();

          if (isCurrentEntry) {
            context.lineWidth = 1.5 / globalScale;
            context.strokeStyle = "rgba(252, 246, 227, 0.96)";
            context.stroke();
          }

          if (shouldDrawLabel) {
            context.font = `${fontSize / globalScale}px var(--font-ui), sans-serif`;
            context.fillStyle = isCurrentEntry
              ? "rgba(252, 246, 227, 0.98)"
              : isDescendantCategory
                ? "rgba(222, 237, 245, 0.72)"
              : hasSelection && !isInPath && !isEntryNode
                ? "rgba(226, 235, 231, 0.3)"
                : "rgba(243, 247, 244, 0.92)";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(node.name, node.x ?? 0, (node.y ?? 0) + radius + 4);
          }

          context.restore();
        }}
        nodeLabel={(node: CategoryGraphNode) => {
          if (node.kind === "entry") {
            const relationLabel = node.entryRelation === "direct" ? "Direct leaf of the selected node" : "Leaf from a descendant subcategory";
            const currentLabel = node.entryId === currentEntryId ? "<div>Current entry</div>" : "";
            return `<div><strong>Entry</strong></div><div>${node.name}</div><div>${relationLabel}</div>${currentLabel}<div>Click to open the entry page</div>`;
          }

          const description = node.description ? `<div>${node.description}</div>` : "";
          return `<div><strong>${node.name}</strong></div><div>${node.entryCount ?? 0} entries · ${node.childCount ?? 0} children</div>${description}`;
        }}
        nodePointerAreaPaint={(node: CategoryGraphNode, color: string, context: CanvasRenderingContext2D) => {
          context.fillStyle = color;
          context.beginPath();
          context.arc(
            node.x ?? 0,
            node.y ?? 0,
            node.kind === "entry" ? largeGraphProfile.pointerRadius.entry : largeGraphProfile.pointerRadius.category,
            0,
            2 * Math.PI,
            false
          );
          context.fill();
        }}
        onBackgroundClick={() => {
          resetView();
        }}
        onNodeClick={(node: CategoryGraphNode) => {
          if (node.kind === "entry" && node.entryId) {
            onEntrySelect?.(node.entryId);
            return;
          }

          onNodeSelect(node.id);

          focusNodeById(node.id);
        }}
        onNodeDragEnd={(node: CategoryGraphNode) => {
          if (node.kind === "entry") {
            return;
          }

          node.fx = node.x;
          node.fy = node.y;
        }}
        ref={graphRef}
        width={dimensions.width}
      />
    </div>
  );
});

GraphView.displayName = "GraphView";