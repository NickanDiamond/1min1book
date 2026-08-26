# Architecture decisions

Full document with diagrams: https://claude.ai/code/artifact/2606b156-0b38-47b1-9738-bd999151d7f7

- **Postgres, not Neo4j.** At 50–100 nodes a graph DB buys nothing, and it does the
  traversal *for* you — which is exactly the part meant to demonstrate you can
  implement BFS/Dijkstra yourself.
- **NetworkX stays in `notebooks/`.** Used to validate the hand-written BFS/Dijkstra
  against a known-correct implementation. Never imported by `apps/api`.
- **pgvector and Redis are deferred**, not rejected — natural post-MVP extensions,
  not MVP requirements.
- **ETL is offline batch, read-only against the source.** The pipeline pulls from
  1Min1Book, computes nodes/edges/weights, and writes into this project's own
  database. Nothing downstream depends on the source system being reachable.
- **Schema is a hybrid**: generic `nodes` + `edges` tables for traversal, plus a
  typed `books` table (1:1 via `node_id`) for book-specific fields. Authors,
  genres, and topics are plain nodes — a name is enough.
- **Edge weights are a transparent formula** (shared themes / genre / author),
  not an unexplained similarity score from a model.

## Update — backend language

Switched `apps/api` from the originally-planned FastAPI (Python) to **Spring
Boot (Java 17)**. Same schema, same phases, same rule that BFS/Dijkstra/the
weight formula are hand-written, not delegated to a library — only the
language changed. Reason: Java/Spring Boot is what's already familiar from
coursework and the BookMatch project, so the portfolio value goes into the
algorithms and design instead of learning a second web framework at the same
time. `etl/` stays Python — it's an offline batch script, not part of the
running service, so there's no reason to port it.
