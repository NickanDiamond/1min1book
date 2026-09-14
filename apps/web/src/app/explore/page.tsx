"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import GraphCanvas from "@/components/GraphCanvas";
import SearchBox from "@/components/SearchBox";
import FilterSidebar from "@/components/FilterSidebar";
import DetailsPanel from "@/components/DetailsPanel";
import { getBookDetail, getNeighbors, getNode } from "@/lib/api";
import { useGraphState } from "@/lib/useGraphState";
import type { BookDetail, GraphNode, Neighbor, NodeType } from "@/lib/types";

const ALL_TYPES: NodeType[] = ["BOOK", "AUTHOR", "GENRE", "TOPIC"];

function ExploreContent() {
  const searchParams = useSearchParams();
  const initialNodeId = searchParams.get("node");

  const { elements, filterByType, expandNode, reset } = useGraphState();
  const [visibleTypes, setVisibleTypes] = useState<Set<NodeType>>(new Set(ALL_TYPES));
  const [depth, setDepth] = useState(1);

  // The details panel previews whatever node was last clicked or searched
  // -- fetched fresh from the API every time, independent of what's
  // actually been placed on the canvas. Clicking around to browse
  // connections no longer floods the canvas; only the explicit "Show on
  // canvas" action (or a fresh search) does that.
  const [previewNode, setPreviewNode] = useState<GraphNode | null>(null);
  const [previewNeighbors, setPreviewNeighbors] = useState<Neighbor[]>([]);
  const [previewBookDetail, setPreviewBookDetail] = useState<BookDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const previewNodeById = useCallback(async (id: number) => {
    setPreviewLoading(true);
    try {
      // getBookDetail resolves to null for a non-BOOK node (the API 404s)
      // -- fetched unconditionally alongside the other two rather than
      // waiting to learn the node's type first, so this stays one round
      // trip instead of a two-step waterfall.
      const [node, neighbors, bookDetail] = await Promise.all([
        getNode(id),
        getNeighbors(id),
        getBookDetail(id),
      ]);
      setPreviewNode(node);
      setPreviewNeighbors(neighbors);
      setPreviewBookDetail(bookDetail);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

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

  // A fresh search is an explicit "show me this" -- clears the canvas,
  // previews the result, and places it (and its neighborhood) right away.
  const handleSearchSelect = useCallback(
    (node: GraphNode) => {
      reset();
      void previewNodeById(node.id);
      void expandToDepth(node.id, depth);
    },
    [reset, previewNodeById, expandToDepth, depth],
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
        void previewNodeById(id);
        void expandToDepth(id, depth);
      }
    }
    // Only run for the node id present when the page first loads --
    // re-running on every dependency identity change would re-fetch on
    // every depth change too, which the slider already handles itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodeId]);

  // Clicking a node on the canvas (or a connection row in the details
  // panel) just previews it -- browsing no longer auto-expands the
  // canvas. The details panel's "Show on canvas" button does that.
  const handleNodeClick = useCallback(
    (id: number) => {
      void previewNodeById(id);
    },
    [previewNodeById],
  );

  const handleExpand = useCallback(
    (id: number) => {
      void expandToDepth(id, depth);
    },
    [expandToDepth, depth],
  );

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
    setPreviewNode(null);
    setPreviewNeighbors([]);
    setPreviewBookDetail(null);
  }, [reset]);

  const filteredElements = useMemo(() => filterByType(visibleTypes), [filterByType, visibleTypes]);

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

      <DetailsPanel
        node={previewNode}
        neighbors={previewNeighbors}
        bookDetail={previewBookDetail}
        loading={previewLoading}
        onSelectNode={(id) => void previewNodeById(id)}
        onExpand={handleExpand}
      />
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
