# ETL

Pipeline: 1Min1Book (read-only) -> extract -> transform -> load into `DATABASE_URL`.

## Steps

1. `extract.py` — parses `data/1_min_1_book_worksheet.xlsx` (a local snapshot,
   not a live API call — see docs/architecture.md) into `data/extracted_books.json`.
   All 663 books.
2. **Theme extraction** — for the first 50 books, done directly by Claude reading
   each Video Script during this session rather than a scripted API call, and
   written to `data/themes.json` (title -> genre + themes with explanations).
   There's no `transform.py` yet because of that — see "Next" below.
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
python3 load.py
```

## Next

- Write a real `transform.py` once an LLM API key (Anthropic or OpenAI) is
  wired up, so theme extraction runs as a script instead of by hand — needed
  before this scales past the first 50 books to the full 663.
- Fold in the Top Lists Fiction/Nonfiction + curated-list signal as a genre
  hint or a confidence boost on BELONGS_TO_GENRE edges.
