package com.oneminonebook.graph.service;

/** One neighbor of a node, with the edge info that connects them --
 * everything the frontend needs to draw one link, resolved server-side. */
public record NeighborView(
        long nodeId,
        String nodeType,
        String nodeName,
        String relationshipType,
        double weight,
        String explanation
) {}
