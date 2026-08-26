# ETL

Pipeline: 1Min1Book (read-only) -> extract -> clean -> theme-tag -> weight -> load into `DATABASE_URL`.

## Confirmed source mapping (from the real worksheet, Aug 2026)

| Field                    | Sheet / column                          | Notes |
|---------------------------|------------------------------------------|-------|
| `external_id`              | `Summaries!Title`                        | All 663 titles are unique — safe as-is, no synthetic ID needed. |
| `title`, `author_text`     | `Summaries!Title`, `Summaries!Author`    | |
| theme-extraction input     | `Summaries!Video Script`                 | ~150–200 word generated narration per book — the real input to the LLM tagging step. |
| bonus genre signal         | `Top Lists!Fiction/Nonfiction`, `!List`  | Only covers 263/663 books. Secondary hint, not a primary source — most books have no list membership. |
| `published_year`, `cover_url` | not present in the source              | Left null for MVP. |

No themes/genre/tags column exists anywhere in the source — every theme comes
from the LLM reading the Video Script text. The "Top Lists" sheet (957 rows,
34 curated best-of lists) is a leftover idea-backlog for which books to
summarize next, not tags for the ones already done.
