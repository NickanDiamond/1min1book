package com.oneminonebook.graph.service;

/** One node in a resolved path, plus the edge used to reach it. The first
 * step has null relationshipType/relationshipLabel/weight/explanation (no
 * incoming edge). relationshipLabel is the direction-correct label for
 * this specific hop (see NeighborView) -- display code should use it, not
 * relationshipType. */
public record PathStepView(
        long nodeId,
        String nodeType,
        String nodeName,
        String relationshipType,
        String relationshipLabel,
        Double weight,
        String explanation
) {}
