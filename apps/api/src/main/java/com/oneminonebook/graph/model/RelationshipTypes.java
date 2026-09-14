package com.oneminonebook.graph.model;

import java.util.Map;

/**
 * Every relationship type is stored directionally (source -> target) --
 * WRITTEN_BY always means "this book was written by this author," never
 * the reverse -- but the graph itself is traversed both ways (see Graph).
 * A UI reading "written by" off an edge from the author's side, describing
 * a book, has it backwards: the author wasn't written by the book. This
 * maps each stored type to the label that's actually correct when the
 * relationship is being read from the edge's target back to its source,
 * instead of from its source forward.
 *
 * SIMILAR_TO has no entry here on purpose -- it's symmetric by
 * construction (two books are equally similar to each other read either
 * direction), so forward and backward are the same label.
 */
public final class RelationshipTypes {

    private static final Map<String, String> INVERSE = Map.of(
            "WRITTEN_BY", "WROTE",
            "DISCUSSES", "DISCUSSED_IN",
            "BELONGS_TO_GENRE", "CONTAINS_BOOK"
    );

    private RelationshipTypes() {}

    /** The label to show when a relationship is read forward, from the
     * edge's own source node -- always just the stored type, unchanged. */
    public static String forward(String relationshipType) {
        return relationshipType;
    }

    /** The label to show when a relationship is read backward, from the
     * edge's target node looking back at its source. A type with no
     * defined inverse (currently only SIMILAR_TO) is symmetric and maps
     * to itself. */
    public static String backward(String relationshipType) {
        return INVERSE.getOrDefault(relationshipType, relationshipType);
    }
}
