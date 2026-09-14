package com.oneminonebook.graph.service;

import java.util.List;

/**
 * Everything the book detail panel needs in one call: the book's own
 * record (summary/author/year/cover), its genre and themes, and its
 * strongest related books -- all resolved server-side from the node's
 * outgoing edges so the frontend doesn't have to cross-reference the
 * generic /neighbors response itself. See GraphService.getBookDetail.
 */
public record BookDetailView(
        long nodeId,
        String title,
        String summary,
        String authorText,
        Integer publishedYear,
        String coverUrl,
        String genre,
        List<ThemeView> themes,
        List<RelatedBookView> related
) {}
