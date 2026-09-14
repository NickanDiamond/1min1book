package com.oneminonebook.graph.graph;

import com.oneminonebook.graph.model.Edge;
import com.oneminonebook.graph.model.RelationshipTypes;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * In-memory undirected adjacency list built from the edges table.
 * Undirected because every relationship type here (WRITTEN_BY,
 * BELONGS_TO_GENRE, DISCUSSES, SIMILAR_TO) is meaningful to traverse in
 * either direction -- e.g. "find a path from this book to that one" should
 * be free to go book -> author -> book, not just follow the direction the
 * edge happened to be inserted in.
 */
public final class Graph {

    /** relationshipLabel is the direction-correct label for traversing
     * this edge specifically *from* the node whose adjacency list this
     * lives in -- see RelationshipTypes. relationshipType is the type as
     * originally stored (source -> target) and stays constant regardless
     * of traversal direction; it's what path reconstruction should treat
     * as the edge's identity, not what should be shown to a user. */
    public record AdjEdge(long neighborId, double weight, String relationshipType, String relationshipLabel, String explanation) {}

    private final Map<Long, List<AdjEdge>> adjacency = new HashMap<>();

    private Graph() {}

    public static Graph fromEdges(List<Edge> edges) {
        Graph graph = new Graph();
        for (Edge edge : edges) {
            graph.addDirected(edge.sourceNodeId(), edge.targetNodeId(), edge, true);
            graph.addDirected(edge.targetNodeId(), edge.sourceNodeId(), edge, false);
        }
        return graph;
    }

    private void addDirected(long from, long to, Edge edge, boolean forward) {
        String label = forward
                ? RelationshipTypes.forward(edge.relationshipType())
                : RelationshipTypes.backward(edge.relationshipType());
        adjacency.computeIfAbsent(from, k -> new ArrayList<>())
                .add(new AdjEdge(to, edge.weight(), edge.relationshipType(), label, edge.explanation()));
    }

    public List<AdjEdge> neighbors(long nodeId) {
        return adjacency.getOrDefault(nodeId, List.of());
    }
}
