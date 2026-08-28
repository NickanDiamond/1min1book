"use client";

import { useState } from "react";
import SearchBox from "./SearchBox";
import { getPath } from "@/lib/api";
import type { GraphNode, PathStep } from "@/lib/types";

export interface PathFinderProps {
  onResult: (steps: PathStep[] | null) => void;
}

export default function PathFinder({ onResult }: PathFinderProps) {
  const [from, setFrom] = useState<GraphNode | null>(null);
  const [to, setTo] = useState<GraphNode | null>(null);
  const [weighted, setWeighted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const canSearch = from !== null && to !== null && !loading;

  async function handleFindPath() {
    if (!from || !to) return;
    setLoading(true);
    setNotFound(false);
    try {
      const steps = await getPath(from.id, to.id, weighted);
      setNotFound(steps === null);
      onResult(steps);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Find a path between two books</h2>
      <SearchBox placeholder="From..." onSelect={setFrom} />
      <SearchBox placeholder="To..." onSelect={setTo} />
      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={weighted}
          onChange={(e) => setWeighted(e.target.checked)}
        />
        Weighted (strongest shared-theme connections, Dijkstra) instead of fewest hops (BFS)
      </label>
      <button
        type="button"
        disabled={!canSearch}
        onClick={() => void handleFindPath()}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Finding path…" : "Find path"}
      </button>
      {notFound && (
        <p className="text-sm text-amber-600">
          No path found{weighted ? " through shared themes" : ""} between these two books.
        </p>
      )}
    </div>
  );
}
