# ETL

Pipeline: 1Min1Book (read-only) -> extract -> transform -> load into `DATABASE_URL`.

## Steps

1. `extract.py` — parses `data/1_min_1_book_worksheet.xlsx` (a local snapshot,
   not a live API call — see docs/architecture.md) into `data/extracted_books.json`.
   All 663 books.
2. `transform.py` — calls an LLM (Anthropic, via a forced tool call so the
   response is always a valid schema, never free-text to parse) on each
   book's Video Script to produce a genre + 2-5 topics, and writes the
   result into `data/themes.json` (title -> genre + topics with
   explanations). Resumable — skips books already in `themes.json` and
   writes after every single book, so an interrupted run picks back up
   without redoing (or re-paying for) finished work.

   The first 50 books' entries in `themes.json` predate this script — they
   were done by hand, by Claude reading each script directly during a
   session. `transform.py` treats them exactly like any other prior run: it
   seeds its topic/genre vocabulary from them and skips re-processing them.

   **Topic normalization** — the actual hard part, not the LLM call itself.
   Every prompt is shown the current topic/genre vocabulary and told to
   reuse an existing name when one fits, so most duplicates never get
   created in the first place. As a deterministic safety net on top of
   that, `Vocabulary` in `transform.py` also catches near-duplicates the
   model didn't reuse: a token-containment check (`government-surveillance`
   shares a token with, and is a superset of, `surveillance`, so it merges
   into it) plus a `difflib` fuzzy-match fallback for plain typos. Every
   merge gets logged to `data/merge_log.json` for a manual sanity check —
   worth reading after a full run. No embeddings/vector DB — this is a
   plain, inspectable heuristic, which is the actual point for a portfolio
   project (see docs/architecture.md).

   Needs `ANTHROPIC_API_KEY` and `ETL_MODEL` in `etl/.env` — see
   `.env.example`. Run with `--limit N` first to sanity-check the output
   (and the cost) before running the remaining ~600 books; `--restart`
   throws away `themes.json` and starts clean.
3. `load.py` — reads both JSON files and writes nodes/books/edges into Postgres.
   Full-refresh: truncates and rebuilds every run, so it's always a clean
   reflection of the two JSON files.

## Confirmed source mapping (from the real worksheet, Aug 2026)

| Field                    | Sheet / column                          | Notes |
|---------------------------|------------------------------------------|-------|
| `external_id`              | `Summaries!Title`                        | All 663 titles are unique — safe as-is, no synthetic ID needed. |
| `title`, `author_text`     | `Summaries!Title`, `Summaries!Author`    | |
| theme-extraction input     | `Summaries!Video Script`                 | ~150–200 word generated narration per book — the real input to the LLM tagging step. |
| bonus genre signal         | `Top Lists!Fiction/Nonfiction`, `!List`  | Only covers 263/663 books. Secondary hint, not a primary source — most books have no list membership. |
| `published_year`, `cover_url` | not present in the source              | Left null for MVP. |

No themes/genre/tags column exists anywhere in the source — every theme came
from reading the Video Script text. The "Top Lists" sheet (957 rows, 34
curated best-of lists) is a leftover idea-backlog for which books to
summarize next, not tags for the ones already done — extracted but not yet
wired into `load.py`.

## Running

```
cd etl
python3 -m venv .venv && source .venv/bin/activate   # outside this sandbox, a normal venv is fine
pip install -r requirements.txt
python3 extract.py
python3 transform.py --limit 5   # sanity-check output + cost before the full run
python3 transform.py             # the rest of the ~663 books; safe to re-run/resume
python3 load.py
```

## Next

- Run `transform.py` against the full 663 books and read `merge_log.json`
  afterward — tune `FUZZY_MERGE_THRESHOLD` if it's merging things that
  shouldn't be merged, or missing ones that should.
- Fold in the Top Lists Fiction/Nonfiction + curated-list signal as a genre
  hint or a confidence boost on BELONGS_TO_GENRE edges.
