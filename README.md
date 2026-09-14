# 1Min1Book Knowledge Graph

Interactive book knowledge graph built on 1Min1Book data — a software engineering
portfolio project (full-stack + ETL + self-implemented graph algorithms).

Full architecture plan (decisions, schema diagram, MVP phases):
https://claude.ai/code/artifact/2606b156-0b38-47b1-9738-bd999151d7f7

Condensed version also lives at `docs/architecture.md` in this repo.

## Live

- Frontend: https://1min1book.vercel.app
- API: https://onemin1book.onrender.com

## Status

- [x] Repo scaffolded, schema migration written, ETL source mapping confirmed
- [x] Phase 1 — schema applied to a live Postgres (Neon) + read-only source access
- [x] Phase 2 — ETL v1 (extract.py, load.py — first 50 books, themes generated manually)
- [x] Phase 3 — Spring Boot API + self-written BFS
- [x] Phase 4 — Next.js + Cytoscape.js frontend v1 (search, explore, expand/collapse, details panel)
- [x] Phase 5 — pathfinding + weights (Dijkstra) + Find-a-Connection UI
- [x] Algorithm unit tests (BfsTest, DijkstraTest)
- [x] Deployed — API on Render, frontend on Vercel
- [ ] transform.py — automated LLM-based theme/genre extraction + topic normalization (currently manual, 50 books only)
- [ ] Full 663-book dataset loaded
- [ ] Integration tests for the API endpoints (search, neighbors, path)
- [ ] CI (mvn test + npm lint/build on push)

## Layout

```
apps/api/      Spring Boot (Java 17) — graph/ (Bfs.java, Dijkstra.java, WeightCalculator.java — hand-written), model/, controller/, repository/
apps/web/      Next.js + TypeScript + Tailwind + Cytoscape.js frontend
etl/           extract → transform → load pipeline (Python), read-only against the 1Min1Book source
db/migrations/ SQL migrations (nodes, books, edges)
notebooks/     NetworkX experiments — never imported by apps/api
docs/          architecture notes
```

## Running the API locally

```
cd apps/api
export SPRING_DATASOURCE_URL=jdbc:postgresql://<host>/<db>?sslmode=require
export SPRING_DATASOURCE_USERNAME=...
export SPRING_DATASOURCE_PASSWORD=...
mvn spring-boot:run
```
