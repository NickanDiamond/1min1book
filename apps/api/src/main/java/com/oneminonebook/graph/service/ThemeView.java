package com.oneminonebook.graph.service;

/** One theme (TOPIC node) a book discusses, with the book-specific
 * explanation for why it applies -- both come off the book's DISCUSSES
 * edges, see GraphService.getBookDetail. */
public record ThemeView(String name, String explanation) {}
