package com.oneminonebook.graph.graph;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.PriorityQueue;

/**
 * Weighted shortest path where edge weight represents connection
 * *strength* in [0, 1] (1.0 = strongest, from the SIMILAR_TO jaccard/genre
 * formula; other relationship types default to 1.0). Dijkstra minimizes a
 * sum of costs, so each edge is traversed at cost = (1 - weight): a chain
 * of strong connections (weight close to 1 => cost close to 0) beats one
 * weak direct edge (weight close to 0 => cost close to 1). That's the
 * behavior we want for "most related" -- a book connected through three
 * strong SIMILAR_TO edges is more related than one with a single weak
 * edge, even though the weak edge is fewer hops. See DijkstraTest for the
 * case that proves this beats a naive "minimize hop count" answer.
 */
public final class Dijkstra {

    private Dijkstra() {}

    private record QueueItem(double cost, long nodeId) implements Comparable<QueueItem> {
        @Override
        public int compareTo(QueueItem other) {
            return Double.compare(this.cost, other.cost);
        }
    }

    public static Optional<List<PathStep>> shortestPath(Graph graph, long fromId, long toId) {
        if (fromId == toId) {
            return Optional.of(List.of(new PathStep(fromId, null, null, null)));
        }

        Map<Long, Double> bestCost = new HashMap<>();
        Map<Long, Long> prevNode = new HashMap<>();
        Map<Long, Graph.AdjEdge> prevEdge = new HashMap<>();
        PriorityQueue<QueueItem> queue = new PriorityQueue<>();

        bestCost.put(fromId, 0.0);
        queue.add(new QueueItem(0.0, fromId));

        while (!queue.isEmpty()) {
            QueueItem current = queue.poll();
            if (current.cost() > bestCost.getOrDefault(current.nodeId(), Double.POSITIVE_INFINITY)) {
                continue; // stale queue entry -- a shorter path to this node was already relaxed
            }
            if (current.nodeId() == toId) {
                break;
            }
            for (Graph.AdjEdge edge : graph.neighbors(current.nodeId())) {
                double candidate = current.cost() + (1.0 - edge.weight());
                if (candidate < bestCost.getOrDefault(edge.neighborId(), Double.POSITIVE_INFINITY)) {
                    bestCost.put(edge.neighborId(), candidate);
                    prevNode.put(edge.neighborId(), current.nodeId());
                    prevEdge.put(edge.neighborId(), edge);
                    queue.add(new QueueItem(candidate, edge.neighborId()));
                }
            }
        }

        if (!bestCost.containsKey(toId)) {
            return Optional.empty();
        }
        return Optional.of(reconstructPath(toId, prevNode, prevEdge));
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
