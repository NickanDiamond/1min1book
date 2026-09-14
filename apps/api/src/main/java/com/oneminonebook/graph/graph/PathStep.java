package com.oneminonebook.graph.graph;

/**
 * One node in a reconstructed path, plus the edge used to reach it from
 * the previous step. The first step in any path has null
 * relationshipType/relationshipLabel/weight/explanation since there is no
 * incoming edge yet. relationshipLabel is the direction-correct label for
 * this specific hop (see RelationshipTypes) -- relationshipType is the
 * edge's stored type and doesn't change with traversal direction.
 */
public record PathStep(long nodeId, String relationshipType, String relationshipLabel, Double weight, String explanation) {}
