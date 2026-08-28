"use client";

import { useCallback, useState } from "react";
import GraphCanvas from "@/components/GraphCanvas";
import SearchBox from "@/components/SearchBox";
import PathFinder from "@/components/PathFinder";
import { getNeighbors, getNode } from "@/lib/api";
import { useGraphState } from "@/lib/useGraphState";
import type { GraphNode, PathStep } from "@/lib/types";

const NODE_TYPE_LEGEND: { type: string; color: string; label: string }[] = [
  { type: "BOOK", color: "#2563eb", label: "Book" },
  { type: "AUTHOR", color: "#059669", label: "Author" },
  { type: "GENRE", color: "#d97706", label: "Genre" },
  { type: "TOPIC", color: "#7c3aed", label: "Topic" },
];

export default function Home() {
  const { elements, expandNode, showPath, clearPath } = useGraphState();
  const [pathSteps, setPathSteps] = useState<PathStep[] | null>(null);

  // Expanding a node means: fetch its own details (in case it isn't on the
  // canvas yet) plus its neighbors, then merge both into the shared graph
  // state. Used both by the search box and by clicking a node in the canvas.
  const expand = useCallback(
    async (id: number) => {
      const [center, neighbors] = await Promise.all([getNode(id), getNeighbors(id)]);
      expandNode(center, neighbors);
    },
    [expandNode],
  );

  const handleSearchSelect = useCallback(
    (node: GraphNode) => {
      void expand(node.id);
    },
    [expand],
  );

  const handleNodeClick = useCallback(
    (id: number) => {
      void expand(id);
    },
    [expand],
  );

  const handlePathResult = useCallback(
    (steps: PathStep[] | null) => {
      setPathSteps(steps);
      if (steps) {
        showPath(steps);
      } else {
        clearPath();
      }
    },
    [showPath, clearPath],
  );

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">1Min1Book Knowledge Graph</h1>
        <p className="text-sm text-gray-500">
          Search a book, click any node to expand its connections, or find a path between two books.
        </p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="relative flex-1">
          <div className="absolute top-4 left-4 z-10 w-80">
            <SearchBox onSelect={handleSearchSelect} />
          </div>
          <div className="absolute top-4 right-4 z-10 flex gap-3 rounded-md bg-white/90 px-3 py-2 text-xs text-gray-600 shadow-sm">
            {NODE_TYPE_LEGEND.map((item) => (
              <span key={item.type} className="flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
          <GraphCanvas elements={elements} onNodeClick={handleNodeClick} />
        </main>

        <aside className="w-96 shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4">
          <PathFinder onResult={handlePathResult} />

          {pathSteps && pathSteps.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Path</h3>
              <ol className="flex flex-col gap-2">
                {pathSteps.map((step, i) => (
                  <li key={`${step.nodeId}-${i}`} className="text-sm text-gray-700">
                    <div className="font-medium">
                      {i + 1}. {step.nodeName ?? `Node ${step.nodeId}`}
                      {step.nodeType && (
                        <span className="ml-2 text-xs font-normal uppercase text-gray-400">
                          {step.nodeType}
                        </span>
                      )}
                    </div>
                    {step.explanation && (
                      <div className="mt-0.5 ml-4 text-xs text-gray-500">
                        via {step.relationshipType?.toLowerCase().replaceAll("_", " ")}
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
      </div>
    </div>
  );
}
