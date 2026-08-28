"use client";

import { useCallback, useMemo, useState } from "react";
import type cytoscape from "cytoscape";
import type { GraphNode, Neighbor, PathStep, RelationshipType } from "./types";

export interface GraphEdge {
  id: string;
  source: number;
  target: number;
  relationshipType: RelationshipType;
  weight: number;
  explanation: string | null;
}

// Undirected: the same pair of nodes should collapse to one edge no matter
// which side of the connection we discovered it from.
function edgeId(a: number, b: number, relationshipType: string): string {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `${lo}-${hi}-${relationshipType}`;
}

/**
 * Client-side accumulation of the graph the user has explored so far --
 * starts empty, grows one search/expand/path-lookup at a time. This is
 * deliberately NOT a full copy of the database: the frontend only ever
 * holds the nodes and edges the user has actually asked to see.
 */
export function useGraphState() {
  const [nodes, setNodes] = useState<Map<number, GraphNode>>(new Map());
  const [edges, setEdges] = useState<Map<string, GraphEdge>>(new Map());
  const [pathNodeIds, setPathNodeIds] = useState<Set<number>>(new Set());
  const [pathEdgeIds, setPathEdgeIds] = useState<Set<string>>(new Set());

  const addNode = useCallback((node: GraphNode) => {
    setNodes((prev) => {
      if (prev.has(node.id)) return prev;
      const next = new Map(prev);
      next.set(node.id, node);
      return next;
    });
  }, []);

  /** The "click a node to expand its neighbors" step: adds the center node
   * (in case it wasn't already on the canvas) plus every neighbor and the
   * edge connecting it. */
  const expandNode = useCallback((center: GraphNode, neighbors: Neighbor[]) => {
    setNodes((prev) => {
      const next = new Map(prev);
      next.set(center.id, center);
      for (const n of neighbors) {
        if (!next.has(n.nodeId)) {
          next.set(n.nodeId, { id: n.nodeId, type: n.nodeType, name: n.nodeName, externalId: null });
        }
      }
      return next;
    });
    setEdges((prev) => {
      const next = new Map(prev);
      for (const n of neighbors) {
        const id = edgeId(center.id, n.nodeId, n.relationshipType);
        if (!next.has(id)) {
          next.set(id, {
            id,
            source: center.id,
            target: n.nodeId,
            relationshipType: n.relationshipType,
            weight: n.weight,
            explanation: n.explanation,
          });
        }
      }
      return next;
    });
  }, []);

  /** Merges a resolved path into the graph and marks it highlighted. Each
   * PathStep already carries its own node name/type and the edge used to
   * reach it from the previous step, so this needs no extra network calls. */
  const showPath = useCallback((steps: PathStep[]) => {
    const newNodes = new Map<number, GraphNode>();
    const newEdges = new Map<string, GraphEdge>();
    const nodeIds = new Set<number>();
    const edgeIds = new Set<string>();

    steps.forEach((step, i) => {
      nodeIds.add(step.nodeId);
      if (step.nodeType && step.nodeName) {
        newNodes.set(step.nodeId, {
          id: step.nodeId,
          type: step.nodeType,
          name: step.nodeName,
          externalId: null,
        });
      }
      if (i > 0 && step.relationshipType) {
        const prevStep = steps[i - 1];
        const id = edgeId(prevStep.nodeId, step.nodeId, step.relationshipType);
        edgeIds.add(id);
        newEdges.set(id, {
          id,
          source: prevStep.nodeId,
          target: step.nodeId,
          relationshipType: step.relationshipType,
          weight: step.weight ?? 1,
          explanation: step.explanation,
        });
      }
    });

    setNodes((prev) => new Map([...prev, ...newNodes]));
    setEdges((prev) => new Map([...prev, ...newEdges]));
    setPathNodeIds(nodeIds);
    setPathEdgeIds(edgeIds);
  }, []);

  const clearPath = useCallback(() => {
    setPathNodeIds(new Set());
    setPathEdgeIds(new Set());
  }, []);

  const elements = useMemo<cytoscape.ElementDefinition[]>(() => {
    const nodeEls: cytoscape.ElementDefinition[] = Array.from(nodes.values()).map((n) => ({
      data: {
        id: String(n.id),
        label: n.name,
        nodeType: n.type,
        highlighted: pathNodeIds.has(n.id),
      },
    }));
    const edgeEls: cytoscape.ElementDefinition[] = Array.from(edges.values()).map((e) => ({
      data: {
        id: e.id,
        source: String(e.source),
        target: String(e.target),
        relationshipType: e.relationshipType,
        weight: e.weight,
        highlighted: pathEdgeIds.has(e.id),
      },
    }));
    return [...nodeEls, ...edgeEls];
  }, [nodes, edges, pathNodeIds, pathEdgeIds]);

  return { nodes, edges, elements, addNode, expandNode, showPath, clearPath };
}
