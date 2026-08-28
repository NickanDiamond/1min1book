package com.oneminonebook.graph.graph;

import com.oneminonebook.graph.model.Edge;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BfsTest {

    @Test
    void findsShortestPathByHopCountIgnoringWeight() {
        // Chain 1-2-3-4 of strong edges, plus a weak direct 1-4 edge.
        // BFS only counts hops, so it should take the direct edge even
        // though it is weak -- that's what distinguishes it from Dijkstra.
        List<Edge> edges = List.of(
                new Edge(1, 1, 2, "SIMILAR_TO", 0.9, null),
                new Edge(2, 2, 3, "SIMILAR_TO", 0.9, null),
                new Edge(3, 3, 4, "SIMILAR_TO", 0.9, null),
                new Edge(4, 1, 4, "SIMILAR_TO", 0.1, null)
        );
        Graph graph = Graph.fromEdges(edges);

        Optional<List<PathStep>> path = Bfs.shortestPath(graph, 1, 4);

        assertTrue(path.isPresent());
        assertEquals(2, path.get().size());
        assertEquals(1L, path.get().get(0).nodeId());
        assertEquals(4L, path.get().get(1).nodeId());
    }

    @Test
    void returnsEmptyWhenNoPathExists() {
        List<Edge> edges = List.of(
                new Edge(1, 1, 2, "SIMILAR_TO", 0.5, null),
                new Edge(2, 3, 4, "SIMILAR_TO", 0.5, null)
        );
        Graph graph = Graph.fromEdges(edges);

        assertTrue(Bfs.shortestPath(graph, 1, 4).isEmpty());
    }

    @Test
    void singleNodePathWhenFromEqualsTo() {
        Graph graph = Graph.fromEdges(List.of());

        Optional<List<PathStep>> path = Bfs.shortestPath(graph, 7, 7);

        assertTrue(path.isPresent());
        assertEquals(1, path.get().size());
        assertEquals(7L, path.get().get(0).nodeId());
    }
}
