package com.oneminonebook.graph.model;

public record Edge(
        long id,
        long sourceNodeId,
        long targetNodeId,
        String relationshipType,
        double weight,
        String explanation
) {}
