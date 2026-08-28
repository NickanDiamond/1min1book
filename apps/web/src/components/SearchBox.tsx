"use client";

import { useEffect, useState } from "react";
import { searchNodes } from "@/lib/api";
import type { GraphNode } from "@/lib/types";

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
      setResults([]);
      return;
    }
    let cancelled = false;
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
        placeholder={placeholder ?? "Search books, authors, genres, topics..."}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && query.trim() !== "" && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {loading && <div className="px-3 py-2 text-sm text-gray-400">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
          )}
          {results.map((node) => (
            <button
              key={node.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(node);
                setQuery(node.name);
                setOpen(false);
              }}
            >
              <span className="text-gray-900">{node.name}</span>
              <span className="ml-2 text-xs uppercase text-gray-400">{node.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
