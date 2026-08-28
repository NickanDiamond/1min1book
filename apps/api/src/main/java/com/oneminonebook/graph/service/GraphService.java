package com.oneminonebook.graph.service;

import com.oneminonebook.graph.graph.Bfs;
import com.oneminonebook.graph.graph.Dijkstra;
import com.oneminonebook.graph.graph.Graph;
import com.oneminonebook.graph.graph.PathStep;
import com.oneminonebook.graph.model.Edge;
import com.oneminonebook.graph.model.Node;
import com.oneminonebook.graph.repository.EdgeRepository;
import com.oneminonebook.graph.repository.NodeRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class GraphService {

    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;

    public GraphService(NodeRepository nodeRepository, EdgeRepository edgeRepository) {
        this.nodeRepository = nodeRepository;
        this.edgeRepository = edgeRepository;
    }

    public List<Node> search(String query) {
        return nodeRepository.search(query);
    }

    public Optional<Node> getNode(long id) {
        return nodeRepository.findById(id);
    }

    /** Every edge touching this node, resolved to the neighbor's own
     * name/type in one batch query so the frontend doesn't need a second
     * round trip per neighbor. */
    public List<NeighborView> neighbors(long nodeId) {
        List<Edge> edges = edgeRepository.findByNode(nodeId);

        List<Long> neighborIds = edges.stream()
                .map(edge -> edge.sourceNodeId() == nodeId ? edge.targetNodeId() : edge.sourceNodeId())
                .collect(Collectors.toList());
        Map<Long, Node> nodesById = nodeRepository.findByIds(neighborIds).stream()
                .collect(Collectors.toMap(Node::id, node -> node));

        List<NeighborView> views = new ArrayList<>();
        for (Edge edge : edges) {
            long neighborId = edge.sourceNodeId() == nodeId ? edge.targetNodeId() : edge.sourceNodeId();
            Node neighbor = nodesById.get(neighborId);
            if (neighbor != null) {
                views.add(new NeighborView(
                        neighbor.id(), neighbor.type(), neighbor.name(),
                        edge.relationshipType(), edge.weight(), edge.explanation()
                ));
            }
        }
        return views;
    }

    /**
     * Loads the whole graph once per request and runs either plain BFS
     * (fewest hops) or hand-written Dijkstra (cost = 1 - weight, favoring
     * strong connections) depending on `weighted`. At this dataset's scale
     * (a few hundred edges) that's simpler than an incremental in-memory
     * cache and still fast enough not to matter.
     */
    public Optional<List<PathStepView>> findPath(long fromId, long toId, boolean weighted) {
        List<Edge> allEdges = edgeRepository.findAll();
        Graph graph = Graph.fromEdges(allEdges);

        Optional<List<PathStep>> rawPath = weighted
                ? Dijkstra.shortestPath(graph, fromId, toId)
                : Bfs.shortestPath(graph, fromId, toId);

        return rawPath.map(this::toViews);
    }

    private List<PathStepView> toViews(List<PathStep> steps) {
        List<Long> ids = steps.stream().map(PathStep::nodeId).collect(Collectors.toList());
        Map<Long, Node> nodesById = nodeRepository.findByIds(ids).stream()
                .collect(Collectors.toMap(Node::id, node -> node));

        return steps.stream()
                .map(step -> {
                    Node node = nodesById.get(step.nodeId());
                    String type = node != null ? node.type() : null;
                    String name = node != null ? node.name() : null;
                    return new PathStepView(
                            step.nodeId(), type, name,
                            step.relationshipType(), step.weight(), step.explanation()
                    );
                })
                .collect(Collectors.toList());
    }
}
