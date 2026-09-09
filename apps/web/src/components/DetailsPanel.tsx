"use client";

import type { GraphNode, Neighbor } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  BOOK: "Book",
  AUTHOR: "Author",
  GENRE: "Genre",
  TOPIC: "Topic",
};

export interface DetailsPanelProps {
  node: GraphNode | null;
  neighbors: Neighbor[];
  loading: boolean;
  /** Preview a different node (drill down through connections without
   * touching the canvas). */
  onSelectNode: (id: number) => void;
  /** Actually place this node and its neighbors on the canvas. */
  onExpand: (id: number) => void;
}

export default function DetailsPanel({
  node,
  neighbors,
  loading,
  onSelectNode,
  onExpand,
}: DetailsPanelProps) {
  if (!node) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-white px-4 py-5">
        <p className="text-sm text-zinc-400">
          Click a node on the canvas, or search above, to see its details and connections here.
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
        <button
          type="button"
          onClick={() => onExpand(node.id)}
          className="mt-3 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
        >
          Show on canvas
        </button>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Connections {!loading && `(${neighbors.length})`}
        </h3>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : neighbors.length === 0 ? (
          <p className="text-sm text-zinc-400">No connections.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {neighbors.map((n) => (
              <li key={`${n.nodeId}-${n.relationshipType}`}>
                <button
                  type="button"
                  onClick={() => onSelectNode(n.nodeId)}
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-zinc-50"
                >
                  <div className="flex items-center justify-between text-sm text-zinc-900">
                    <span>{n.nodeName}</span>
                    <span className="ml-2 text-xs uppercase text-zinc-400">
                      {TYPE_LABEL[n.nodeType] ?? n.nodeType}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {n.relationshipType.toLowerCase().replaceAll("_", " ")}
                    {n.relationshipType === "SIMILAR_TO" && ` (weight ${n.weight.toFixed(2)})`}
                    {n.explanation && ` — ${n.explanation}`}
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
