# 1Min1Book Knowledge Graph

Interactive book knowledge graph built on 1Min1Book data — a software engineering
portfolio project (full-stack + ETL + self-implemented graph algorithms).

Full architecture plan (decisions, schema diagram, MVP phases):
https://claude.ai/code/artifact/2606b156-0b38-47b1-9738-bd999151d7f7

Condensed version also lives at `docs/architecture.md` in this repo.

## Status

- [ ] Phase 1 — schema + read-only source access
- [ ] Phase 2 — ETL v1 (50–100 books)
- [ ] Phase 3 — FastAPI + self-written BFS
- [ ] Phase 4 — Next.js + Cytoscape.js frontend v1
- [ ] Phase 5 — pathfinding + weights (Dijkstra)
- [ ] Phase 6 — tests, deploy, docs

## Layout

```
apps/api/      FastAPI service — routers/, graph/ (bfs.py, dijkstra.py, weights.py — hand-written), models/, tests/
apps/web/      Next.js + TypeScript + Tailwind + Cytoscape.js frontend
etl/           extract → transform → load pipeline, read-only against the 1Min1Book source
db/migrations/ SQL migrations (nodes, books, edges)
notebooks/     NetworkX experiments — never imported by apps/api
docs/          architecture notes
```
