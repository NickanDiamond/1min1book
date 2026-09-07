"use client";

import { useEffect, useState } from "react";
import { searchNodes } from "@/lib/api";
import type { GraphNode } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  BOOK: "Book",
  AUTHOR: "Author",
  GENRE: "Genre",
  TOPIC: "Topic",
};

export interface SearchBoxProps {
  placeholder?: string;
  onSelect: (node: GraphNode) => void;
}

export default function SearchBox({ placeholder, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GraphNode[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      return;
    }
    let cancelled = false;
    // Intentional: this Effect fetches search results whenever `query`
    // changes, and flips a loading flag while that fetch is in flight --
    // the standard "Effect that syncs with an external system" case React's
    // docs describe, not the "you might not need an Effect" case this rule
    // otherwise guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // Debounce -- avoid firing a search request on every keystroke.
    const timer = setTimeout(() => {
      searchNodes(query)
        .then((nodes) => {
          if (!cancelled) setResults(nodes);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder ?? "Search books, authors, genres, topics…"}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && query.trim() !== "" && (
        <div className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {loading && <div className="px-3.5 py-2 text-sm text-zinc-400">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="px-3.5 py-2 text-sm text-zinc-400">No matches</div>
          )}
          {results.map((node) => (
            <button
              key={node.id}
              type="button"
              className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-zinc-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(node);
                setQuery(node.name);
                setOpen(false);
              }}
            >
              <span className="text-zinc-900">{node.name}</span>
              <span className="ml-2 text-xs uppercase text-zinc-400">
                {TYPE_LABEL[node.type] ?? node.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
