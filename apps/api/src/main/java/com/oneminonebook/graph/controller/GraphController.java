package com.oneminonebook.graph.controller;

import com.oneminonebook.graph.model.Node;
import com.oneminonebook.graph.service.GraphService;
import com.oneminonebook.graph.service.NeighborView;
import com.oneminonebook.graph.service.PathStepView;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class GraphController {

    private final GraphService graphService;

    public GraphController(GraphService graphService) {
        this.graphService = graphService;
    }

    @GetMapping("/search")
    public List<Node> search(@RequestParam String q) {
        return graphService.search(q);
    }

    @GetMapping("/nodes/{id}")
    public ResponseEntity<Node> getNode(@PathVariable long id) {
        return graphService.getNode(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/nodes/{id}/neighbors")
    public List<NeighborView> neighbors(@PathVariable long id) {
        return graphService.neighbors(id);
    }

    /**
     * weighted=false (default): plain BFS, fewest hops.
     * weighted=true: hand-written Dijkstra over cost = 1 - weight,
     * favoring a chain of strong connections over a short but weak one.
     */
    @GetMapping("/graph/path")
    public ResponseEntity<List<PathStepView>> path(
            @RequestParam long from,
            @RequestParam long to,
            @RequestParam(defaultValue = "false") boolean weighted
    ) {
        return graphService.findPath(from, to, weighted)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
