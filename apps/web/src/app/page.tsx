"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBox from "@/components/SearchBox";
import type { GraphNode } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  const handleSelect = useCallback(
    (node: GraphNode) => {
      setNavigating(true);
      router.push(`/explore?node=${node.id}`);
    },
    [router],
  );

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-white px-6">
      <div className="w-full max-w-lg">
        <h1 className="text-center text-2xl font-medium tracking-tight text-zinc-900">
          1Min1Book Knowledge Graph
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          Search a book, author, genre, or topic to start exploring how it connects to
          everything else.
        </p>

        <div className="mt-8">
          <SearchBox onSelect={handleSelect} placeholder="Search books, authors, genres, topics…" />
        </div>

        {navigating && <p className="mt-3 text-center text-xs text-zinc-400">Loading…</p>}

        <div className="mt-10 flex justify-center">
          <a href="/connect" className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-700 hover:underline">
            Or find a connection between two books →
          </a>
        </div>
      </div>
    </main>
  );
}
