"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import GraphCanvas from "@/components/GraphCanvas";
import SearchBox from "@/components/SearchBox";
import FilterSidebar from "@/components/FilterSidebar";
import DetailsPanel from "@/components/DetailsPanel";
import { getNeighbors, getNode } from "@/lib/api";
import { useGraphState } from "@/lib/useGraphState";
import type { GraphEdge } from "@/lib/useGraphState";
import type { GraphNode, NodeType } from "@/lib/types";

const ALL_TYPES: NodeType[] = ["BOOK", "AUTHOR", "GENRE", "TOPIC"];

function ExploreContent() {
  const searchParams = useSearchParams();
  const initialNodeId = searchParams.get("node");

  const { nodes, edges, elements, filterByType, expandNode, reset } = useGraphState();
  const [visibleTypes, setVisibleTypes] = useState<Set<NodeType>>(new Set(ALL_TYPES));
  const [depth, setDepth] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  // Fetches `id`'s own record plus its neighbors out to `depth` hops,
  // merging each level into the shared graph state as it resolves so the
  // canvas fills in progressively rather than waiting on the whole walk.
  const expandToDepth = useCallback(
    async (rootId: number, hops: number) => {
      const visited = new Set<number>();
      let frontier = [rootId];
      for (let level = 0; level < hops && frontier.length > 0; level++) {
        const toFetch = frontier.filter((id) => !visited.has(id));
        toFetch.forEach((id) => visited.add(id));
        const results = await Promise.all(
          toFetch.map((id) => Promise.all([getNode(id), getNeighbors(id)])),
        );
        const nextFrontier: number[] = [];
        results.forEach(([center, neighbors]) => {
          expandNode(center, neighbors);
          neighbors.forEach((n) => {
            if (!visited.has(n.nodeId)) nextFrontier.push(n.nodeId);
          });
        });
        frontier = nextFrontier;
      }
    },
    [expandNode],
  );

  const selectAndExpand = useCallback(
    (id: number) => {
      setSelectedNodeId(id);
      void expandToDepth(id, depth);
    },
    [expandToDepth, depth],
  );

  useEffect(() => {
    if (initialNodeId) {
      const id = Number(initialNodeId);
      if (Number.isFinite(id)) {
        // Intentional: this Effect syncs the `?node=` URL param into graph
        // state once when the page loads -- exactly the "adjust state
        // based on a prop" case React's own docs treat as a legitimate
        // Effect, not the "you might not need an Effect" case this rule
        // otherwise guards against.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        selectAndExpand(id);
      }
    }
    // Only run for the node id present when the page first loads --
    // re-running on every `selectAndExpand` identity change would re-fetch
    // on every depth change too, which the slider already handles itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodeId]);

  const handleSearchSelect = useCallback(
    (node: GraphNode) => {
      // A fresh search starts a clean canvas -- clicking a node already on
      // the canvas still accumulates (that's the "explore outward"
      // feature), but searching for something new shouldn't pile it on
      // top of whatever's already there.
      reset();
      selectAndExpand(node.id);
    },
    [reset, selectAndExpand],
  );
  const handleNodeClick = useCallback((id: number) => selectAndExpand(id), [selectAndExpand]);

  const handleToggleType = useCallback((type: NodeType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    reset();
    setSelectedNodeId(null);
  }, [reset]);

  const filteredElements = useMemo(() => filterByType(visibleTypes), [filterByType, visibleTypes]);

  const selectedNode = selectedNodeId !== null ? (nodes.get(selectedNodeId) ?? null) : null;
  const selectedNeighbors = useMemo(() => {
    if (selectedNodeId === null) return [];
    return Array.from(edges.values())
      .filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
      .map((edge) => {
        const otherId = edge.source === selectedNodeId ? edge.target : edge.source;
        const other = nodes.get(otherId);
        return other ? { edge, other } : null;
      })
      .filter((x): x is { edge: GraphEdge; other: GraphNode } => x !== null);
  }, [edges, nodes, selectedNodeId]);

  return (
    <>
      <FilterSidebar
        visibleTypes={visibleTypes}
        onToggleType={handleToggleType}
        depth={depth}
        onDepthChange={setDepth}
        onReset={handleReset}
      />

      <main className="relative min-h-0 flex-1">
        <div className="absolute top-4 left-4 z-10 w-80">
          <SearchBox onSelect={handleSearchSelect} />
        </div>
        {elements.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Search for a node above to start exploring.
          </div>
        ) : (
          <GraphCanvas elements={filteredElements} onNodeClick={handleNodeClick} />
        )}
      </main>

      <DetailsPanel node={selectedNode} neighbors={selectedNeighbors} onSelectNode={selectAndExpand} />
    </>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <ExploreContent />
    </Suspense>
  );
}
