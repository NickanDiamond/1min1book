package com.oneminonebook.graph.repository;

import com.oneminonebook.graph.model.Node;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Repository
public class NodeRepository {

    private static final RowMapper<Node> NODE_MAPPER = (rs, rowNum) -> new Node(
            rs.getLong("id"),
            rs.getString("type"),
            rs.getString("name"),
            rs.getString("external_id")
    );

    private final JdbcTemplate jdbc;

    public NodeRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Node> findById(long id) {
        return jdbc.query("SELECT id, type, name, external_id FROM nodes WHERE id = ?", NODE_MAPPER, id)
                .stream().findFirst();
    }

    /** Batch lookup so callers building a path or a neighbor list don't
     * issue one query per node (see GraphService). */
    public List<Node> findByIds(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        String sql = "SELECT id, type, name, external_id FROM nodes WHERE id IN (" + placeholders + ")";
        return jdbc.query(sql, NODE_MAPPER, ids.toArray());
    }

    /** Case-insensitive substring search across every node type -- books,
     * authors, genres, and topics all show up in the same search box. */
    public List<Node> search(String query) {
        String pattern = "%" + query.toLowerCase() + "%";
        return jdbc.query(
                "SELECT id, type, name, external_id FROM nodes WHERE lower(name) LIKE ? ORDER BY type, name LIMIT 25",
                NODE_MAPPER, pattern
        );
    }
}
