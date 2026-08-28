package com.oneminonebook.graph.service;

/** One node in a resolved path, plus the edge used to reach it. The first
 * step has null relationshipType/weight/explanation (no incoming edge). */
public record PathStepView(
        long nodeId,
        String nodeType,
        String nodeName,
        String relationshipType,
        Double weight,
        String explanation
) {}
