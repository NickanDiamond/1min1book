"use client";

import { useCallback, useState } from "react";
import GraphCanvas from "@/components/GraphCanvas";
import SearchBox from "@/components/SearchBox";
import { getPath } from "@/lib/api";
import { useGraphState } from "@/lib/useGraphState";
import type { GraphNode, PathStep } from "@/lib/types";

export default function ConnectPage() {
  const { elements, pathActive, showPath, reset } = useGraphState();
  const [from, setFrom] = useState<GraphNode | null>(null);
  const [to, setTo] = useState<GraphNode | null>(null);
  const [weighted, setWeighted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [steps, setSteps] = useState<PathStep[] | null>(null);

  const canSearch = from !== null && to !== null && !loading;

  const handleFindPath = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setNotFound(false);
    setSteps(null);
    // Each new path search starts from a clean canvas -- otherwise nodes
    // and edges from a previous, unrelated search stick around and
    // clutter (or literally overlap) the new path's layout.
    reset();
    try {
      const result = await getPath(from.id, to.id, weighted);
      if (result === null) {
        setNotFound(true);
        return;
      }
      setSteps(result);
      showPath(result);
    } finally {
      setLoading(false);
    }
  }, [from, to, weighted, reset, showPath]);

  return (
    <>
      <aside className="flex w-96 shrink-0 flex-col gap-5 overflow-y-auto border-r border-zinc-200 bg-white px-5 py-6">
        <div>
          <h1 className="text-base font-medium text-zinc-900">Find a connection</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Pick two books and see the shortest path of shared authors, genres, and themes
            between them.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <SearchBox placeholder="From…" onSelect={setFrom} />
          <SearchBox placeholder="To…" onSelect={setTo} />

          <label className="flex items-start gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              className="mt-0.5 accent-zinc-900"
              checked={weighted}
              onChange={(e) => setWeighted(e.target.checked)}
            />
            Weighted — strongest shared-theme connections (Dijkstra) instead of fewest hops (BFS)
          </label>

          <button
            type="button"
            disabled={!canSearch}
            onClick={() => void handleFindPath()}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
          >
            {loading ? "Finding path…" : "Find path"}
          </button>

          {notFound && (
            <p className="text-sm text-amber-600">
              No path found{weighted ? " through shared themes" : ""} between these two books.
            </p>
          )}
        </div>

        {steps && steps.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Path ({steps.length} node{steps.length === 1 ? "" : "s"})
            </h2>
            <ol className="flex flex-col gap-3">
              {steps.map((step, i) => (
                <li key={`${step.nodeId}-${i}`} className="text-sm text-zinc-700">
                  <div className="font-medium text-zinc-900">
                    {i + 1}. {step.nodeName ?? `Node ${step.nodeId}`}
                    {step.nodeType && (
                      <span className="ml-2 text-xs font-normal uppercase text-zinc-400">
                        {step.nodeType}
                      </span>
                    )}
                  </div>
                  {step.explanation && (
                    <div className="mt-0.5 text-xs text-zinc-500">
                      via {step.relationshipLabel?.toLowerCase().replaceAll("_", " ")}
                      {typeof step.weight === "number" && ` (weight ${step.weight.toFixed(2)})`}
                      {" — "}
                      {step.explanation}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>

      <main className="relative min-h-0 flex-1">
        {elements.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Pick two books and find a path to see it drawn here.
          </div>
        ) : (
          <GraphCanvas
            elements={elements}
            onNodeClick={() => {}}
            dimNonPath={pathActive}
            layoutName="cose"
          />
        )}
      </main>
    </>
  );
}
