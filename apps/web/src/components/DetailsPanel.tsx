"use client";

import type { GraphNode } from "@/lib/types";
import type { GraphEdge } from "@/lib/useGraphState";

const TYPE_LABEL: Record<string, string> = {
  BOOK: "Book",
  AUTHOR: "Author",
  GENRE: "Genre",
  TOPIC: "Topic",
};

export interface DetailsPanelProps {
  node: GraphNode | null;
  neighbors: { edge: GraphEdge; other: GraphNode }[];
  onSelectNode: (id: number) => void;
}

export default function DetailsPanel({ node, neighbors, onSelectNode }: DetailsPanelProps) {
  if (!node) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-white px-4 py-5">
        <p className="text-sm text-zinc-400">
          Click a node on the canvas to see its details and connections here.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-zinc-200 bg-white px-4 py-5">
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {TYPE_LABEL[node.type] ?? node.type}
        </span>
        <h2 className="mt-1 text-base font-medium text-zinc-900">{node.name}</h2>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Connections ({neighbors.length})
        </h3>
        {neighbors.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No connections loaded yet -- click this node on the canvas to expand it.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {neighbors.map(({ edge, other }) => (
              <li key={edge.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(other.id)}
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-zinc-50"
                >
                  <div className="flex items-center justify-between text-sm text-zinc-900">
                    <span>{other.name}</span>
                    <span className="ml-2 text-xs uppercase text-zinc-400">
                      {TYPE_LABEL[other.type] ?? other.type}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {edge.relationshipType.toLowerCase().replaceAll("_", " ")}
                    {edge.relationshipType === "SIMILAR_TO" && ` (weight ${edge.weight.toFixed(2)})`}
                    {edge.explanation && ` — ${edge.explanation}`}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
