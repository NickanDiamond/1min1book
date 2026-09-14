package com.oneminonebook.graph.service;

/** One other book connected by a SIMILAR_TO edge, for the book detail
 * panel's "Related" list -- see GraphService.getBookDetail. Sorted by
 * weight (strongest connection first) and capped by the caller. */
public record RelatedBookView(long nodeId, String title, double weight) {}
