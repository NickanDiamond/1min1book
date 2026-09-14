package com.oneminonebook.graph.repository;

import com.oneminonebook.graph.model.Book;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class BookRepository {

    private static final RowMapper<Book> BOOK_MAPPER = (rs, rowNum) -> new Book(
            rs.getLong("node_id"),
            rs.getString("summary"),
            rs.getString("author_text"),
            rs.getObject("published_year", Integer.class),
            rs.getString("cover_url")
    );

    private final JdbcTemplate jdbc;

    public BookRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Book> findByNodeId(long nodeId) {
        return jdbc.query(
                "SELECT node_id, summary, author_text, published_year, cover_url FROM books WHERE node_id = ?",
                BOOK_MAPPER, nodeId
        ).stream().findFirst();
    }
}
