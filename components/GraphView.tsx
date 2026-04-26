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

const graphBackground = "#0f1614";

function edgeKey(sourceId: string, targetId: string) {
  return `${sourceId}->${targetId}`;
}

export const GraphView = forwardRef<GraphViewHandle, GraphViewProps>(function GraphView(
  { edges, nodes, onEntrySelect, onNodeSelect, selectedNodeId, isVisible = true },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 920, height: 620 });

  const graphNodes = useMemo(() => nodes.map((node) => ({ ...node })), [nodes]);
  const graphLinks = useMemo<GraphLink[]>(
    () => edges.map((edge) => ({ ...edge, id: edgeKey(edge.source, edge.target) })),
    [edges]
  );
  const prominentNodeIds = useMemo(() => {
    const labelLimit =
      graphNodes.length > 140 ? 6 : graphNodes.length > 90 ? 8 : graphNodes.length > 45 ? 12 : 18;

    return new Set(
      [...graphNodes]
        .sort((left, right) => {
          const weightDifference = (right.childCount ?? 0) + (right.entryCount ?? 0) - ((left.childCount ?? 0) + (left.entryCount ?? 0));
          if (weightDifference !== 0) {
            return weightDifference;
          }

          return left.name.localeCompare(right.name);
        })
        .slice(0, labelLimit)
        .map((node) => node.id)
    );
  }, [graphNodes]);
  const layoutProfile = useMemo(() => {
    const nodeCount = graphNodes.length;

    return {
      alphaDecay: nodeCount > 120 ? 0.02 : nodeCount > 60 ? 0.028 : 0.04,
      chargeStrength: nodeCount > 120 ? -250 : nodeCount > 60 ? -205 : -165,
      cooldownTicks: nodeCount > 120 ? 260 : nodeCount > 60 ? 210 : 150,
      labelZoomThreshold: nodeCount > 120 ? 2.45 : nodeCount > 60 ? 2.05 : 1.55,
      linkDistance: nodeCount > 120 ? 40 : nodeCount > 60 ? 52 : 74,
      linkStrength: nodeCount > 120 ? 0.62 : nodeCount > 60 ? 0.72 : 0.9,
      velocityDecay: nodeCount > 120 ? 0.34 : nodeCount > 60 ? 0.3 : 0.26
    };
  }, [graphNodes.length]);

  const highlightedNodeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const parentMap = new Map(nodes.map((node) => [node.id, node.parentId]));
    const ids = new Set<string>();
    let currentNodeId: string | null | undefined = selectedNodeId;

    while (currentNodeId) {
      ids.add(currentNodeId);
      currentNodeId = parentMap.get(currentNodeId);
    }

    return ids;
  }, [nodes, selectedNodeId]);

  const highlightedEdgeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const parentMap = new Map(nodes.map((node) => [node.id, node.parentId]));
    const ids = new Set<string>();
    let currentNodeId: string | null | undefined = selectedNodeId;

    while (currentNodeId) {
      const parentId = parentMap.get(currentNodeId);
      if (!parentId) {
        break;
      }

      ids.add(edgeKey(parentId, currentNodeId));
      currentNodeId = parentId;
    }

    return ids;
  }, [nodes, selectedNodeId]);

  const focusNodeById = useCallback((nodeId: string, zoomLevel = 2.1) => {
    const targetNode = graphNodes.find((node) => node.id === nodeId);
    if (!targetNode || typeof targetNode.x !== "number" || typeof targetNode.y !== "number") {
      return;
    }

    graphRef.current?.centerAt(targetNode.x, targetNode.y, 600);
    graphRef.current?.zoom(zoomLevel, 600);
  }, [graphNodes]);

  const resetView = useCallback(() => {
    graphRef.current?.zoomToFit(700, graphNodes.length > 80 ? 120 : 80);
  }, [graphNodes.length]);

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

    chargeForce?.strength?.(layoutProfile.chargeStrength);
    linkForce?.distance?.(layoutProfile.linkDistance);
    linkForce?.strength?.(layoutProfile.linkStrength);
    graphRef.current.d3ReheatSimulation?.();
  }, [graphLinks, graphNodes.length, layoutProfile]);

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
        cooldownTicks={layoutProfile.cooldownTicks}
        d3AlphaDecay={layoutProfile.alphaDecay}
        d3VelocityDecay={layoutProfile.velocityDecay}
        enableNodeDrag
        enablePanInteraction
        enablePointerInteraction
        enableZoomInteraction
        graphData={{ links: graphLinks, nodes: graphNodes }}
        height={dimensions.height}
        linkColor={(link: GraphLink) => {
          if (highlightedEdgeIds.has(link.id)) {
            return "rgba(127, 221, 188, 0.92)";
          }

          if (selectedNodeId) {
            return "rgba(146, 159, 155, 0.12)";
          }

          return "rgba(146, 159, 155, 0.28)";
        }}
        linkDirectionalParticles={(link: GraphLink) => (highlightedEdgeIds.has(link.id) ? 2 : 0)}
        linkDirectionalParticleColor={() => "rgba(236, 244, 228, 0.86)"}
        linkDirectionalParticleSpeed={0.008}
        linkWidth={(link: GraphLink) => (highlightedEdgeIds.has(link.id) ? 2.4 : selectedNodeId ? 0.6 : 1)}
        nodeCanvasObject={(node: CategoryGraphNode, context: CanvasRenderingContext2D, globalScale: number) => {
          const isSelected = node.id === selectedNodeId;
          const isInPath = highlightedNodeIds.has(node.id);
          const hasSelection = Boolean(selectedNodeId);
          const isEntryNode = node.kind === "entry";
          const nodeWeight = isEntryNode ? 0 : Math.min(4, (node.childCount ?? 0) * 0.22 + (node.entryCount ?? 0) * 0.08);
          const radius = (isEntryNode ? 4.8 : isSelected ? 8 : isInPath ? 6 : 4) + nodeWeight;
          const fontSize = isEntryNode ? 10 : isSelected ? 14 : isInPath ? 12 : 10;
          const shouldDrawLabel =
            isEntryNode ||
            isSelected ||
            isInPath ||
            globalScale > layoutProfile.labelZoomThreshold ||
            (!hasSelection && prominentNodeIds.has(node.id));

          context.save();
          context.beginPath();
          context.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false);
          context.fillStyle = isSelected
            ? "#f4e6b7"
            : isEntryNode
              ? "rgba(224, 188, 119, 0.95)"
            : isInPath
              ? "#7fddbc"
              : hasSelection
                ? "rgba(178, 194, 188, 0.22)"
                : "rgba(176, 209, 199, 0.86)";
          context.shadowColor = isSelected ? "#f4e6b7" : isEntryNode ? "rgba(224, 188, 119, 0.7)" : isInPath ? "#7fddbc" : "transparent";
          context.shadowBlur = isSelected || isInPath || isEntryNode ? 18 : 0;
          context.fill();

          if (shouldDrawLabel) {
            context.font = `${fontSize / globalScale}px var(--font-ui), sans-serif`;
            context.fillStyle = hasSelection && !isInPath ? "rgba(226, 235, 231, 0.3)" : "rgba(243, 247, 244, 0.92)";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(node.name, node.x ?? 0, (node.y ?? 0) + radius + 4);
          }

          context.restore();
        }}
        nodeLabel={(node: CategoryGraphNode) => {
          if (node.kind === "entry") {
            return `<div><strong>Entry</strong></div><div>${node.name}</div><div>Click to open the entry page</div>`;
          }

          const description = node.description ? `<div>${node.description}</div>` : "";
          return `<div><strong>${node.name}</strong></div><div>${node.entryCount ?? 0} entries · ${node.childCount ?? 0} children</div>${description}`;
        }}
        nodePointerAreaPaint={(node: CategoryGraphNode, color: string, context: CanvasRenderingContext2D) => {
          context.fillStyle = color;
          context.beginPath();
          context.arc(node.x ?? 0, node.y ?? 0, node.kind === "entry" ? 12 : 15, 0, 2 * Math.PI, false);
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