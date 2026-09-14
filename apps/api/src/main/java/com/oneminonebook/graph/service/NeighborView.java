package com.oneminonebook.graph.service;

/** One neighbor of a node, with the edge info that connects them --
 * everything the frontend needs to draw one link, resolved server-side.
 *
 * relationshipType is always the type as stored (source -> target),
 * regardless of which side `nodeId` -- the *other* node -- is on; it's
 * what identifies the underlying edge, so it stays constant no matter
 * which node you're looking from. relationshipLabel is the direction-
 * correct human label for describing this specific relationship *from
 * the node this view was requested for*, e.g. "WROTE" instead of
 * "WRITTEN_BY" when nodeId is the author, not the book. Display code
 * should read relationshipLabel; relationshipType is for identity. */
public record NeighborView(
        long nodeId,
        String nodeType,
        String nodeName,
        String relationshipType,
        String relationshipLabel,
        double weight,
        String explanation
) {}
