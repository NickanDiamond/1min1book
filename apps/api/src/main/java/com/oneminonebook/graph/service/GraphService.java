package com.oneminonebook.graph.service;

import com.oneminonebook.graph.graph.Bfs;
import com.oneminonebook.graph.graph.Dijkstra;
import com.oneminonebook.graph.graph.Graph;
import com.oneminonebook.graph.graph.PathStep;
import com.oneminonebook.graph.model.Edge;
import com.oneminonebook.graph.model.Node;
import com.oneminonebook.graph.model.RelationshipTypes;
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

    private static final String SIMILAR_TO = "SIMILAR_TO";

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
            boolean forward = edge.sourceNodeId() == nodeId;
            long neighborId = forward ? edge.targetNodeId() : edge.sourceNodeId();
            Node neighbor = nodesById.get(neighborId);
            if (neighbor != null) {
                // forward: nodeId is the edge's own source, so the stored
                // type already reads correctly (a book asking about its
                // WRITTEN_BY edge still means "written by"). Otherwise
                // nodeId is the target looking back at its source, which
                // needs the inverse label (an author's WRITTEN_BY edge
                // reads as "wrote", not "written by").
                String label = forward
                        ? RelationshipTypes.forward(edge.relationshipType())
                        : RelationshipTypes.backward(edge.relationshipType());
                views.add(new NeighborView(
                        neighbor.id(), neighbor.type(), neighbor.name(),
                        edge.relationshipType(), label, edge.weight(), edge.explanation()
                ));
            }
        }
        return views;
    }

    /**
     * weighted=false: plain BFS over every relationship type -- "how are
     * these two nodes connected at all," fewest hops, ignoring strength.
     *
     * weighted=true: Dijkstra over SIMILAR_TO edges ONLY, cost = 1 - weight.
     * This is deliberate, not an oversight: WRITTEN_BY/BELONGS_TO_GENRE/
     * DISCUSSES edges default to weight 1.0 (cost 0), so if Dijkstra were
     * allowed to use them it would always route through a shared genre or
     * author for free instead of a weaker-but-more-meaningful SIMILAR_TO
     * connection -- "same genre" would silently out-rank "shares the theme
     * of authoritarianism" every time. Restricting the weighted query to
     * SIMILAR_TO keeps its meaning crisp: "how strongly are these books
     * related by extracted theme," not "are they trivially in the same
     * bucket." A consequence is that two books with no SIMILAR_TO chain
     * between them return no weighted path even if BFS could reach them
     * through a genre/author node -- that's the graph honestly reporting
     * "not related by theme," not a bug.
     */
    public Optional<List<PathStepView>> findPath(long fromId, long toId, boolean weighted) {
        List<Edge> allEdges = edgeRepository.findAll();
        List<Edge> edgesForTraversal = weighted
                ? allEdges.stream()
                        .filter(edge -> SIMILAR_TO.equals(edge.relationshipType()))
                        .collect(Collectors.toList())
                : allEdges;
        Graph graph = Graph.fromEdges(edgesForTraversal);

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
                            step.relationshipType(), step.relationshipLabel(), step.weight(), step.explanation()
                    );
                })
                .collect(Collectors.toList());
    }
}
