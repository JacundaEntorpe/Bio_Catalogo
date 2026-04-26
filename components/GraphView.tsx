"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

const ForceGraph2D: any = dynamic(() => import("react-force-graph-2d"), {
  ssr: false
});

export type GraphViewNode = {
  id: string;
  name: string;
  parentId: string | null;
  description?: string | null;
  ownerId?: string | null;
  entryCount?: number;
  childCount?: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

export type GraphViewEdge = {
  source: string;
  target: string;
};

type GraphViewProps = {
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
  selectedNodeId?: string | null;
  onNodeSelect: (nodeId: string) => void;
};

type GraphLink = GraphViewEdge & {
  id: string;
};

const graphBackground = "#0f1614";

function edgeKey(sourceId: string, targetId: string) {
  return `${sourceId}->${targetId}`;
}

export function GraphView({ edges, nodes, onNodeSelect, selectedNodeId }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 920, height: 620 });

  const graphNodes = useMemo(() => nodes.map((node) => ({ ...node })), [nodes]);
  const graphLinks = useMemo<GraphLink[]>(
    () => edges.map((edge) => ({ ...edge, id: edgeKey(edge.source, edge.target) })),
    [edges]
  );

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

    const timeoutId = window.setTimeout(() => {
      graphRef.current?.zoomToFit(700, 80);
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [graphLinks, graphNodes]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const targetNode = graphNodes.find((node) => node.id === selectedNodeId);
    if (!targetNode || typeof targetNode.x !== "number" || typeof targetNode.y !== "number") {
      return;
    }

    graphRef.current?.centerAt(targetNode.x, targetNode.y, 600);
    graphRef.current?.zoom(2.1, 600);
  }, [graphNodes, selectedNodeId]);

  return (
    <div className="graph-view" ref={containerRef}>
      <ForceGraph2D
        backgroundColor={graphBackground}
        cooldownTicks={140}
        d3AlphaDecay={0.045}
        d3VelocityDecay={0.26}
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
        nodeCanvasObject={(node: GraphViewNode, context: CanvasRenderingContext2D, globalScale: number) => {
          const isSelected = node.id === selectedNodeId;
          const isInPath = highlightedNodeIds.has(node.id);
          const hasSelection = Boolean(selectedNodeId);
          const radius = isSelected ? 8 : isInPath ? 6 : 4;
          const fontSize = isSelected ? 14 : isInPath ? 12 : 10;
          const shouldDrawLabel = isSelected || isInPath || globalScale > 1.55;

          context.save();
          context.beginPath();
          context.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false);
          context.fillStyle = isSelected
            ? "#f4e6b7"
            : isInPath
              ? "#7fddbc"
              : hasSelection
                ? "rgba(178, 194, 188, 0.22)"
                : "rgba(176, 209, 199, 0.86)";
          context.shadowColor = isSelected ? "#f4e6b7" : isInPath ? "#7fddbc" : "transparent";
          context.shadowBlur = isSelected || isInPath ? 18 : 0;
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
        nodeLabel={(node: GraphViewNode) => {
          const description = node.description ? `<div>${node.description}</div>` : "";
          return `<div><strong>${node.name}</strong></div><div>${node.entryCount ?? 0} entries · ${node.childCount ?? 0} children</div>${description}`;
        }}
        nodePointerAreaPaint={(node: GraphViewNode, color: string, context: CanvasRenderingContext2D) => {
          context.fillStyle = color;
          context.beginPath();
          context.arc(node.x ?? 0, node.y ?? 0, 12, 0, 2 * Math.PI, false);
          context.fill();
        }}
        onBackgroundClick={() => {
          graphRef.current?.zoomToFit(700, 80);
        }}
        onNodeClick={(node: GraphViewNode) => {
          onNodeSelect(node.id);

          if (typeof node.x === "number" && typeof node.y === "number") {
            graphRef.current?.centerAt(node.x, node.y, 700);
            graphRef.current?.zoom(2.1, 700);
          }
        }}
        onNodeDragEnd={(node: GraphViewNode) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        ref={graphRef}
        width={dimensions.width}
      />
    </div>
  );
}