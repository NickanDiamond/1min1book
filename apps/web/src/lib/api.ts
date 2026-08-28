import type { GraphNode, Neighbor, PathStep } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function searchNodes(query: string): Promise<GraphNode[]> {
  if (!query.trim()) {
    return Promise.resolve([]);
  }
  return getJson<GraphNode[]>(`/api/search?q=${encodeURIComponent(query)}`);
}

export function getNode(id: number): Promise<GraphNode> {
  return getJson<GraphNode>(`/api/nodes/${id}`);
}

export function getNeighbors(id: number): Promise<Neighbor[]> {
  return getJson<Neighbor[]>(`/api/nodes/${id}/neighbors`);
}

/**
 * Returns null when the API reports no path exists (HTTP 404) -- that's a
 * legitimate answer for this graph (e.g. two books with no shared theme
 * chain under weighted=true), not an error.
 */
export async function getPath(
  fromId: number,
  toId: number,
  weighted: boolean,
): Promise<PathStep[] | null> {
  const url = `/api/graph/path?from=${fromId}&to=${toId}&weighted=${weighted}`;
  const res = await fetch(url);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status}`);
  }
  return res.json() as Promise<PathStep[]>;
}
