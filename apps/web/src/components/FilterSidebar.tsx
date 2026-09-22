"use client";

import type { NodeType, RelatedBook } from "@/lib/types";

const TYPE_OPTIONS: { type: NodeType; label: string; color: string; shape: string }[] = [
  { type: "BOOK", label: "Books", color: "#3b6fd6", shape: "rounded-[3px]" },
  { type: "AUTHOR", label: "Authors", color: "#2f9e6e", shape: "rounded-full" },
  { type: "GENRE", label: "Genres", color: "#d2892f", shape: "rotate-45" },
  { type: "TOPIC", label: "Topics", color: "#8b5fc2", shape: "rotate-45" },
];

export interface FilterSidebarProps {
  visibleTypes: Set<NodeType>;
  onToggleType: (type: NodeType) => void;
  depth: number;
  onDepthChange: (depth: number) => void;
  onReset: () => void;
  /** The currently-previewed book's SIMILAR_TO neighbors, already sorted
   * strongest-first -- null when nothing's previewed, or the previewed
   * node isn't a book. */
  relatedBooks: RelatedBook[] | null;
  /** Places a related book (and its own neighborhood) on the canvas and
   * switches the details panel to it, in one click -- no separate preview
   * step first. */
  onAddRelated: (nodeId: number) => void;
}

export default function FilterSidebar({
  visibleTypes,
  onToggleType,
  depth,
  onDepthChange,
  onReset,
  relatedBooks,
  onAddRelated,
}: FilterSidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-zinc-200 bg-white px-4 py-5">
      <div>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Show
        </h2>
        <div className="flex flex-col gap-1">
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.type}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <input
                type="checkbox"
                checked={visibleTypes.has(opt.type)}
                onChange={() => onToggleType(opt.type)}
                className="h-3.5 w-3.5 accent-zinc-900"
              />
              <span
                className={`inline-block h-2.5 w-2.5 ${opt.shape}`}
                style={{ backgroundColor: opt.color }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Expansion depth
        </h2>
        <input
          type="range"
          min={1}
          max={3}
          step={1}
          value={depth}
          onChange={(e) => onDepthChange(Number(e.target.value))}
          className="w-full accent-zinc-900"
        />
        <p className="mt-1 text-xs text-zinc-500">
          {depth} hop{depth > 1 ? "s" : ""} out when you search or expand a node
        </p>
      </div>

      {relatedBooks && relatedBooks.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Similar books
          </h2>
          <ul className="flex flex-col gap-1">
            {relatedBooks.map((r) => (
              <li key={r.nodeId}>
                <button
                  type="button"
                  onClick={() => onAddRelated(r.nodeId)}
                  title="Add to canvas"
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  <span className="truncate">{r.title}</span>
                  <span className="ml-2 shrink-0 text-xs text-zinc-400">{r.weight.toFixed(2)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        className="mt-auto self-start text-xs text-zinc-400 hover:text-zinc-700"
      >
        Clear canvas
      </button>
    </aside>
  );
}
