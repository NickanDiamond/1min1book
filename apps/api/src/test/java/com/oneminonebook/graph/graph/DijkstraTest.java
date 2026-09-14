package com.oneminonebook.graph.graph;

import com.oneminonebook.graph.model.Edge;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DijkstraTest {

    @Test
    void prefersChainOfStrongConnectionsOverOneWeakDirectEdge() {
        // 1 --0.9-- 2 --0.9-- 3 --0.9-- 4   (three strong hops)
        // 1 --0.1-------------------- 4     (one weak direct hop)
        // cost = 1 - weight, so the chain costs 0.1+0.1+0.1 = 0.3 while the
        // direct edge costs 0.9. The chain should win even though it has
        // more hops -- that's the entire point of using Dijkstra here
        // instead of BFS: "most related" beats "fewest hops."
        List<Edge> edges = List.of(
                new Edge(1, 1, 2, "SIMILAR_TO", 0.9, null),
                new Edge(2, 2, 3, "SIMILAR_TO", 0.9, null),
                new Edge(3, 3, 4, "SIMILAR_TO", 0.9, null),
                new Edge(4, 1, 4, "SIMILAR_TO", 0.1, null)
        );
        Graph graph = Graph.fromEdges(edges);

        Optional<List<PathStep>> path = Dijkstra.shortestPath(graph, 1, 4);

        assertTrue(path.isPresent());
        List<Long> nodeIds = path.get().stream().map(PathStep::nodeId).collect(Collectors.toList());
        assertEquals(List.of(1L, 2L, 3L, 4L), nodeIds);
    }

    @Test
    void prefersShortStrongPathOverLongerNearlyAsStrongChain() {
        // 1 --0.99--2--0.99--3--0.99--4--0.99--5--0.99-- 6  (five very strong hops)
        // 1 --0.94------------------------------------- 6  (one strong direct hop)
        // Without HOP_PENALTY, cost = 1 - weight alone would make the chain
        // cost 0.01*5 = 0.05 and the direct edge cost 0.06 -- the chain
        // would (barely) win, producing a 5-hop "most related" path when a
        // nearly-as-strong direct connection was sitting right there. With
        // HOP_PENALTY = 0.05, the chain costs (0.01+0.05)*5 = 0.30 against
        // the direct edge's 0.06+0.05 = 0.11 -- the direct edge should win
        // decisively instead.
        List<Edge> edges = List.of(
                new Edge(1, 1, 2, "SIMILAR_TO", 0.99, null),
                new Edge(2, 2, 3, "SIMILAR_TO", 0.99, null),
                new Edge(3, 3, 4, "SIMILAR_TO", 0.99, null),
                new Edge(4, 4, 5, "SIMILAR_TO", 0.99, null),
                new Edge(5, 5, 6, "SIMILAR_TO", 0.99, null),
                new Edge(6, 1, 6, "SIMILAR_TO", 0.94, null)
        );
        Graph graph = Graph.fromEdges(edges);

        Optional<List<PathStep>> path = Dijkstra.shortestPath(graph, 1, 6);

        assertTrue(path.isPresent());
        List<Long> nodeIds = path.get().stream().map(PathStep::nodeId).collect(Collectors.toList());
        assertEquals(List.of(1L, 6L), nodeIds);
    }

    @Test
    void takesDirectEdgeWhenItIsAlsoTheStrongestOption() {
        List<Edge> edges = List.of(
                new Edge(1, 1, 2, "SIMILAR_TO", 0.2, null),
                new Edge(2, 2, 3, "SIMILAR_TO", 0.2, null),
                new Edge(3, 1, 3, "SIMILAR_TO", 0.9, null)
        );
        Graph graph = Graph.fromEdges(edges);

        Optional<List<PathStep>> path = Dijkstra.shortestPath(graph, 1, 3);

        assertTrue(path.isPresent());
        List<Long> nodeIds = path.get().stream().map(PathStep::nodeId).collect(Collectors.toList());
        assertEquals(List.of(1L, 3L), nodeIds);
    }

    @Test
    void returnsEmptyWhenNoPathExists() {
        List<Edge> edges = List.of(
                new Edge(1, 1, 2, "SIMILAR_TO", 0.5, null)
        );
        Graph graph = Graph.fromEdges(edges);

        assertTrue(Dijkstra.shortestPath(graph, 1, 99).isEmpty());
    }
}
