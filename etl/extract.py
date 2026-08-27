"""
Extract step: read the 1Min1Book worksheet and produce a clean, structured
list of books to hand to transform.py.

Reads a local export of the worksheet rather than calling the Google Sheets
API live. That's a deliberate choice, not a shortcut: the architecture plan
calls for the source connection to be read-only and decoupled from anything
downstream, and a point-in-time export satisfies that even more strongly
than a live API call would (nothing here can accidentally write back, and a
re-run is byte-for-byte reproducible). Swap this function for a Sheets API
pull later without touching transform.py or load.py — they only see the
list[Book] this module returns.
"""

import argparse
import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path

import openpyxl

DEFAULT_WORKSHEET_PATH = Path(__file__).parent / "data" / "1_min_1_book_worksheet.xlsx"
DEFAULT_OUTPUT_PATH = Path(__file__).parent / "data" / "extracted_books.json"


@dataclass
class Book:
    external_id: str          # the title — unique across all 663 rows, see docs/architecture.md
    title: str
    author: str
    video_script: str         # the real input to theme extraction in transform.py
    fiction_nonfiction: str | None = None   # "F" / "NF", from Top Lists, when available
    curated_lists: list[str] | None = None  # e.g. "Pulitzer Prize Top 50" — bonus signal, ~40% coverage


def _header_index(header_row) -> dict[str, int]:
    """Map column name -> 1-based column index, so row access doesn't depend
    on column order in the source file."""
    index = {}
    for col, cell in enumerate(header_row, start=1):
        if cell.value:
            index[str(cell.value).strip()] = col
    return index


def _load_top_lists(wb) -> dict[str, dict]:
    """title (lowercased) -> {fiction_nonfiction, curated_lists}. Only 263 of
    the 663 summarized books show up here — see docs/architecture.md."""
    ws = wb["Top Lists"]
    header = _header_index(ws[1])
    by_title: dict[str, dict] = {}
    for row in ws.iter_rows(min_row=2):
        title = row[header["Title"] - 1].value
        if not title:
            continue
        key = str(title).strip().lower()
        fnf = row[header["Fiction/Nonfiction"] - 1].value
        list_name = row[header["List"] - 1].value
        entry = by_title.setdefault(key, {"fiction_nonfiction": fnf, "curated_lists": []})
        if list_name:
            entry["curated_lists"].append(str(list_name).strip())
    return by_title


def extract(worksheet_path: Path = DEFAULT_WORKSHEET_PATH, limit: int | None = None) -> list[Book]:
    wb = openpyxl.load_workbook(worksheet_path, data_only=True)
    summaries = wb["Summaries"]
    header = _header_index(summaries[1])
    top_lists = _load_top_lists(wb)

    books: list[Book] = []
    for row in summaries.iter_rows(min_row=2):
        title = row[header[" Title"] - 1].value  # note: source header has a leading space
        if not title:
            continue
        author = row[header["Author"] - 1].value
        video_script = row[header["Video Script"] - 1].value

        key = str(title).strip().lower()
        bonus = top_lists.get(key, {})

        books.append(Book(
            external_id=str(title).strip(),
            title=str(title).strip(),
            author=str(author).strip() if author else "",
            video_script=str(video_script).strip() if video_script else "",
            fiction_nonfiction=bonus.get("fiction_nonfiction"),
            curated_lists=bonus.get("curated_lists") or None,
        ))

        if limit and len(books) >= limit:
            break

    return books


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None, help="Only extract the first N books (for a fast first pass)")
    parser.add_argument("--worksheet", type=Path, default=DEFAULT_WORKSHEET_PATH)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT_PATH)
    args = parser.parse_args()

    books = extract(args.worksheet, args.limit)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w") as f:
        json.dump([asdict(b) for b in books], f, indent=2)

    with_bonus = sum(1 for b in books if b.fiction_nonfiction or b.curated_lists)
    print(f"Extracted {len(books)} books -> {args.out}")
    print(f"  {with_bonus} of them have a bonus Fiction/Nonfiction or curated-list signal from Top Lists")
    if books:
        print(f"  sample: {books[0].title} by {books[0].author} ({len(books[0].video_script)} chars of script)")


if __name__ == "__main__":
    main()
