"use client";

import type { BookDetail, GraphNode, Neighbor } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  BOOK: "Book",
  AUTHOR: "Author",
  GENRE: "Genre",
  TOPIC: "Topic",
};

export interface DetailsPanelProps {
  node: GraphNode | null;
  neighbors: Neighbor[];
  /** Book-specific detail (summary, genre, themes, related books) --
   * null for a non-BOOK node, or while still loading. See BookDetails
   * below: when this is present for a BOOK node, it replaces the plain
   * connections list with a richer, book-shaped view. */
  bookDetail: BookDetail | null;
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
  bookDetail,
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

  // A BOOK node with its detail loaded gets the richer book-shaped view;
  // everything else (author/genre/topic nodes, or a book whose detail
  // hasn't resolved yet) falls back to the plain connections list, which
  // works for every node type unconditionally.
  const showBookDetails = node.type === "BOOK" && bookDetail !== null;

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

      {showBookDetails ? (
        <BookDetails detail={bookDetail} />
      ) : (
        <ConnectionsList neighbors={neighbors} loading={loading} onSelectNode={onSelectNode} />
      )}
    </aside>
  );
}

function BookDetails({ detail }: { detail: BookDetail }) {
  return (
    <>
      {(detail.authorText || detail.genre) && (
        <div className="text-sm text-zinc-600">
          {detail.authorText && <div>{detail.authorText}</div>}
          {detail.genre && <div className="text-zinc-400">{detail.genre}</div>}
        </div>
      )}

      {detail.summary && <p className="text-sm leading-relaxed text-zinc-700">{detail.summary}</p>}

      {detail.themes.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Themes</h3>
          <ul className="flex flex-col gap-2">
            {detail.themes.map((t) => (
              <li key={t.name} className="text-sm">
                <span className="font-medium text-zinc-900">{t.name.replaceAll("-", " ")}</span>
                {t.explanation && <p className="mt-0.5 text-xs text-zinc-500">{t.explanation}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related books live in the left sidebar now (FilterSidebar's
          "Similar books" list) as a one-click add-to-canvas, instead of
          duplicating them here as a preview-only list. */}
    </>
  );
}

function ConnectionsList({
  neighbors,
  loading,
  onSelectNode,
}: {
  neighbors: Neighbor[];
  loading: boolean;
  onSelectNode: (id: number) => void;
}) {
  return (
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
                  {n.relationshipLabel.toLowerCase().replaceAll("_", " ")}
                  {n.relationshipType === "SIMILAR_TO" && ` (weight ${n.weight.toFixed(2)})`}
                  {n.explanation && ` — ${n.explanation}`}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
