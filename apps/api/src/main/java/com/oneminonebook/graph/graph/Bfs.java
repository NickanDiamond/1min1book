package com.oneminonebook.graph.graph;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Unweighted shortest path -- fewest hops, ignoring edge weight entirely.
 * This is the "how are these connected at all" query; Dijkstra (below) is
 * the "what's the *strongest* chain of connections" query.
 */
public final class Bfs {

    private Bfs() {}

    public static Optional<List<PathStep>> shortestPath(Graph graph, long fromId, long toId) {
        if (fromId == toId) {
            return Optional.of(List.of(new PathStep(fromId, null, null, null)));
        }

        Set<Long> visited = new HashSet<>();
        Map<Long, Long> prevNode = new HashMap<>();
        Map<Long, Graph.AdjEdge> prevEdge = new HashMap<>();
        Deque<Long> queue = new ArrayDeque<>();

        visited.add(fromId);
        queue.add(fromId);

        while (!queue.isEmpty()) {
            long current = queue.poll();
            if (current == toId) {
                return Optional.of(reconstructPath(toId, prevNode, prevEdge));
            }
            for (Graph.AdjEdge edge : graph.neighbors(current)) {
                if (visited.add(edge.neighborId())) {
                    prevNode.put(edge.neighborId(), current);
                    prevEdge.put(edge.neighborId(), edge);
                    queue.add(edge.neighborId());
                }
            }
        }
        return Optional.empty();
    }

    private static List<PathStep> reconstructPath(
            long toId, Map<Long, Long> prevNode, Map<Long, Graph.AdjEdge> prevEdge
    ) {
        LinkedList<PathStep> path = new LinkedList<>();
        long node = toId;
        while (prevNode.containsKey(node)) {
            Graph.AdjEdge edge = prevEdge.get(node);
            path.addFirst(new PathStep(node, edge.relationshipType(), edge.weight(), edge.explanation()));
            node = prevNode.get(node);
        }
        path.addFirst(new PathStep(node, null, null, null));
        return path;
    }
}
