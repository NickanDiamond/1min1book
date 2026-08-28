package com.oneminonebook.graph.graph;

/**
 * One node in a reconstructed path, plus the edge used to reach it from
 * the previous step. The first step in any path has null
 * relationshipType/weight/explanation since there is no incoming edge yet.
 */
public record PathStep(long nodeId, String relationshipType, Double weight, String explanation) {}
