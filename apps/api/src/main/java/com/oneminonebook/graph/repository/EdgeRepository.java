package com.oneminonebook.graph.repository;

import com.oneminonebook.graph.model.Edge;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class EdgeRepository {

    private static final RowMapper<Edge> EDGE_MAPPER = (rs, rowNum) -> new Edge(
            rs.getLong("id"),
            rs.getLong("source_node_id"),
            rs.getLong("target_node_id"),
            rs.getString("relationship_type"),
            rs.getDouble("weight"),
            rs.getString("explanation")
    );

    private final JdbcTemplate jdbc;

    public EdgeRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The whole graph's edges -- a few hundred rows at this scale, small
     * enough to load once per request and traverse in memory rather than
     * re-querying Postgres at every BFS/Dijkstra step. */
    public List<Edge> findAll() {
        return jdbc.query(
                "SELECT id, source_node_id, target_node_id, relationship_type, weight, explanation FROM edges",
                EDGE_MAPPER
        );
    }

    public List<Edge> findByNode(long nodeId) {
        return jdbc.query(
                "SELECT id, source_node_id, target_node_id, relationship_type, weight, explanation " +
                        "FROM edges WHERE source_node_id = ? OR target_node_id = ?",
                EDGE_MAPPER, nodeId, nodeId
        );
    }
}
