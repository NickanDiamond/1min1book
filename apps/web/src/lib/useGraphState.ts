"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type cytoscape from "cytoscape";
import type { GraphNode, Neighbor, NodeType, PathStep, RelationshipType } from "./types";

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

const STEP_DELAY_MS = 450;

// GraphCanvas now wraps long labels onto a second line (text-wrap: wrap +
// text-max-width, with BOOK nodes additionally sizing themselves to their
// own title) instead of relying on this to shorten them first -- an
// ellipsis was losing real title text the canvas has room for once it
// actually accounts for label size during layout. This safety cap only
// exists for the pathological case (a title/subtitle long enough that
// even two wrapped lines would look broken), and is generous enough that
// no real book/author/genre/topic name in this dataset should ever hit it.
const MAX_LABEL_LENGTH = 80;
function truncateLabel(name: string): string {
  return name.length > MAX_LABEL_LENGTH ? `${name.slice(0, MAX_LABEL_LENGTH - 1)}…` : name;
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

  // Path-reveal state, used by the Find a Connection screen. pathNodeIds /
  // pathEdgeIds is the *full* path (used to decide what to dim); revealed*
  // grows one step at a time to drive the reveal animation.
  const [pathNodeIds, setPathNodeIds] = useState<Set<number>>(new Set());
  const [pathEdgeIds, setPathEdgeIds] = useState<Set<string>>(new Set());
  const [revealedNodeIds, setRevealedNodeIds] = useState<Set<number>>(new Set());
  const [revealedEdgeIds, setRevealedEdgeIds] = useState<Set<string>>(new Set());
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const mergeNeighbors = useCallback((center: GraphNode, neighbors: Neighbor[]) => {
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

  /** Single-hop expand: adds the center node plus its direct neighbors. */
  const expandNode = useCallback(
    (center: GraphNode, neighbors: Neighbor[]) => mergeNeighbors(center, neighbors),
    [mergeNeighbors],
  );

  /** Clears everything -- used when jumping to a brand new root node. */
  const reset = useCallback(() => {
    setNodes(new Map());
    setEdges(new Map());
    setPathNodeIds(new Set());
    setPathEdgeIds(new Set());
    setRevealedNodeIds(new Set());
    setRevealedEdgeIds(new Set());
  }, []);

  /**
   * Merges a resolved path into the graph, then reveals it one hop at a
   * time (used by the Find a Connection screen). While a path is active,
   * `dimNonPath` (below) tells the canvas to fade everything that isn't on
   * the path, and `revealedNodeIds`/`revealedEdgeIds` grow on a timer so
   * the highlight visibly travels along the path instead of appearing all
   * at once.
   */
  const showPath = useCallback((steps: PathStep[]) => {
    revealTimers.current.forEach(clearTimeout);
    revealTimers.current = [];

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
    setRevealedNodeIds(new Set());
    setRevealedEdgeIds(new Set());

    steps.forEach((step, i) => {
      const timer = setTimeout(() => {
        setRevealedNodeIds((prev) => new Set(prev).add(step.nodeId));
        if (i > 0 && step.relationshipType) {
          const prevStep = steps[i - 1];
          const id = edgeId(prevStep.nodeId, step.nodeId, step.relationshipType);
          setRevealedEdgeIds((prev) => new Set(prev).add(id));
        }
      }, i * STEP_DELAY_MS);
      revealTimers.current.push(timer);
    });
  }, []);

  const clearPath = useCallback(() => {
    revealTimers.current.forEach(clearTimeout);
    revealTimers.current = [];
    setPathNodeIds(new Set());
    setPathEdgeIds(new Set());
    setRevealedNodeIds(new Set());
    setRevealedEdgeIds(new Set());
  }, []);

  const pathActive = pathNodeIds.size > 0;

  const elements = useMemo<cytoscape.ElementDefinition[]>(() => {
    const nodeEls: cytoscape.ElementDefinition[] = Array.from(nodes.values()).map((n) => ({
      data: {
        id: String(n.id),
        label: truncateLabel(n.name),
        nodeType: n.type,
        inPath: pathActive ? pathNodeIds.has(n.id) : false,
        highlighted: pathActive ? revealedNodeIds.has(n.id) : false,
      },
    }));
    const edgeEls: cytoscape.ElementDefinition[] = Array.from(edges.values()).map((e) => ({
      data: {
        id: e.id,
        source: String(e.source),
        target: String(e.target),
        relationshipType: e.relationshipType,
        weight: e.weight,
        inPath: pathActive ? pathEdgeIds.has(e.id) : false,
        highlighted: pathActive ? revealedEdgeIds.has(e.id) : false,
      },
    }));
    return [...nodeEls, ...edgeEls];
  }, [nodes, edges, pathActive, pathNodeIds, pathEdgeIds, revealedNodeIds, revealedEdgeIds]);

  /** Elements filtered down to a set of visible node types -- an edge is
   * hidden if either endpoint is hidden, since Cytoscape errors on an edge
   * that references a node not present in the element set. */
  const filterByType = useCallback(
    (visibleTypes: Set<NodeType>) => {
      const visibleIds = new Set(
        Array.from(nodes.values())
          .filter((n) => visibleTypes.has(n.type))
          .map((n) => n.id),
      );
      return elements.filter((el) => {
        const data = el.data as { id?: string; source?: string; target?: string };
        if (data.source !== undefined && data.target !== undefined) {
          return visibleIds.has(Number(data.source)) && visibleIds.has(Number(data.target));
        }
        return visibleIds.has(Number(data.id));
      });
    },
    [nodes, elements],
  );

  return {
    nodes,
    edges,
    elements,
    pathActive,
    expandNode,
    showPath,
    clearPath,
    reset,
    filterByType,
  };
}
