from __future__ import annotations

"""
Transform step: turn each book's title/author/video script into structured
genre + topic data via an LLM call, normalizing topic/genre names against a
growing canonical vocabulary so near-duplicate concepts ("Government
Surveillance", "Surveillance", "State Surveillance") collapse into one node
instead of three.

Two-layer normalization, both inspectable -- no embeddings or vector DB:

  1. Prompt-level reuse: every call is shown the current canonical topic and
     genre vocabulary and told to reuse an existing name whenever it fits,
     only coining a new one -- in the same style -- when nothing already
     covers the concept.
  2. Deterministic safety net: whatever name comes back is slugified
     (topics: lowercase, hyphenated) and, if it isn't an exact match to
     something already in the vocabulary, compared against it with difflib
     for a close match above FUZZY_MERGE_THRESHOLD. A close match is merged
     into the existing name instead of creating a near-duplicate; every merge
     is logged to merge_log.json so it can be eyeballed and the threshold
     tuned.

Structured output comes from a forced tool call (record_themes), not from
parsing free-form text -- the model can't hand back malformed JSON because
it isn't producing JSON at all, it's filling in a schema.

Resumable by default: writes themes.json after every single book (not just
at the end) and skips books that already have an entry, so an interrupted
run -- and 663 sequential API calls over a slow connection *will* get
interrupted sooner or later -- loses zero completed work and costs nothing
extra to resume.
"""

import argparse
import difflib
import json
import os
import re
import sys
import time
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

DATA_DIR = Path(__file__).parent / "data"
EXTRACTED_PATH = DATA_DIR / "extracted_books.json"
THEMES_PATH = DATA_DIR / "themes.json"
MERGE_LOG_PATH = DATA_DIR / "merge_log.json"

# difflib.SequenceMatcher ratio (0-1). Start conservative -- a missed merge
# just means two topic nodes that should be one; a wrong merge means two
# genuinely different concepts get silently conflated, which is worse and
# harder to notice. Tune by reading merge_log.json after a real run.
FUZZY_MERGE_THRESHOLD = 0.82

SYSTEM_PROMPT = """You are extracting structured theme data from a 1Min1Book video script, for a knowledge graph that connects books by shared themes.

Call record_themes with:
- genre: a short, Title Case genre name (e.g. "Dystopian Fiction")
- topics: 2-5 topics a well-read person would use to describe what this book is *about* thematically -- not generic plot beats

You will also be shown the genre and topic vocabulary already used elsewhere in this dataset. Reuse an existing name whenever it genuinely fits this book, even if you would phrase it slightly differently yourself -- the goal is one node per underlying concept, not one node per book. Only introduce a new name when nothing already in the vocabulary covers it."""

THEMES_TOOL = {
    "name": "record_themes",
    "description": "Record the genre and thematic topics extracted for this book.",
    "input_schema": {
        "type": "object",
        "properties": {
            "genre": {
                "type": "string",
                "description": "Short genre name, Title Case, e.g. 'Dystopian Fiction'",
            },
            "topics": {
                "type": "array",
                "minItems": 2,
                "maxItems": 5,
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Short topic slug, lowercase, hyphen-separated, e.g. 'surveillance'",
                        },
                        "explanation": {
                            "type": "string",
                            "description": "One sentence tying this specific book to that topic",
                        },
                    },
                    "required": ["name", "explanation"],
                },
            },
        },
        "required": ["genre", "topics"],
    },
}


def slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


class Vocabulary:
    """Tracks canonical genre and topic names seen so far, and resolves a
    freshly-extracted name to an existing one via exact match or a
    difflib close-match fallback -- logging every fuzzy merge it makes."""

    def __init__(self):
        self.genres: set[str] = set()
        self.topics: set[str] = set()
        self.merge_log: list[dict] = []

    def seed_from_themes(self, themes: dict):
        for info in themes.values():
            self.genres.add(info["genre"])
            for t in info["topics"]:
                self.topics.add(t["name"])

    def resolve_topic(self, raw_name: str) -> str:
        candidate = slugify(raw_name)
        if candidate in self.topics:
            return candidate
        if not self.topics:
            self.topics.add(candidate)
            return candidate

        # Containment match: "government-surveillance" and "surveillance"
        # share a token and one's token set is a subset of the other's --
        # treat them as the same underlying concept. This is what actually
        # catches the "Government Surveillance" vs "Surveillance" case a
        # plain string-similarity check misses, since the two strings
        # differ by an entire extra word and so score as dissimilar overall
        # even though one is just a more specific phrasing of the other.
        candidate_tokens = set(candidate.split("-"))
        contained = [
            v for v in self.topics
            if candidate_tokens.issubset(set(v.split("-"))) or set(v.split("-")).issubset(candidate_tokens)
        ]
        if contained:
            # Prefer the shortest (most general) existing match as canonical.
            matched = min(contained, key=len)
            if matched != candidate:
                self.merge_log.append({"kind": "topic", "raw": raw_name, "merged_into": matched, "method": "containment"})
            return matched

        # Fuzzy fallback for near-typo variants of the same single word
        # (e.g. the model writing "propoganda" instead of "propaganda") --
        # containment above already handles the multi-word phrasing case.
        best = difflib.get_close_matches(candidate, list(self.topics), n=1, cutoff=FUZZY_MERGE_THRESHOLD)
        if best:
            matched = best[0]
            if matched != candidate:
                self.merge_log.append({"kind": "topic", "raw": raw_name, "merged_into": matched, "method": "fuzzy"})
            return matched

        self.topics.add(candidate)
        return candidate

    def resolve_genre(self, raw_name: str) -> str:
        candidate = raw_name.strip()
        if candidate in self.genres:
            return candidate
        if not self.genres:
            self.genres.add(candidate)
            return candidate

        # Genres are short, Title Case phrases with much less of the
        # compound-prefix problem topics have ("Dystopian Fiction" is
        # genuinely more specific than "Fiction", not a duplicate of it) --
        # a case-insensitive fuzzy match is enough here.
        best = difflib.get_close_matches(
            candidate.lower(), [g.lower() for g in self.genres], n=1, cutoff=FUZZY_MERGE_THRESHOLD
        )
        if best:
            matched = next(g for g in self.genres if g.lower() == best[0])
            if matched != candidate:
                self.merge_log.append({"kind": "genre", "raw": raw_name, "merged_into": matched, "method": "fuzzy"})
            return matched

        self.genres.add(candidate)
        return candidate


def build_user_message(book: dict, vocab: Vocabulary) -> str:
    genre_list = ", ".join(sorted(vocab.genres)) or "(none yet)"
    topic_list = ", ".join(sorted(vocab.topics)) or "(none yet)"
    script = book["video_script"][:6000]  # scripts are ~150-200 words; this is just a safety cap
    return (
        f"Existing genres: {genre_list}\n\n"
        f"Existing topics: {topic_list}\n\n"
        f"Title: {book['title']}\nAuthor: {book['author']}\n\nScript:\n{script}"
    )


def call_model(client: Anthropic, model: str, book: dict, vocab: Vocabulary) -> dict:
    message = client.messages.create(
        model=model,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=[THEMES_TOOL],
        tool_choice={"type": "tool", "name": "record_themes"},
        messages=[{"role": "user", "content": build_user_message(book, vocab)}],
    )
    tool_use = next(b for b in message.content if b.type == "tool_use")
    return tool_use.input


def transform_one(client: Anthropic, model: str, book: dict, vocab: Vocabulary, retries: int = 3) -> dict:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            raw = call_model(client, model, book, vocab)
            genre = vocab.resolve_genre(raw["genre"])
            topics = [
                {"name": vocab.resolve_topic(t["name"]), "explanation": t["explanation"]}
                for t in raw["topics"]
            ]
            return {"genre": genre, "topics": topics}
        except Exception as e:  # noqa: BLE001 -- retry on any transient failure (rate limit, network blip, bad response)
            last_error = e
            time.sleep(2**attempt)
    raise RuntimeError(f"failed after {retries} attempts: {last_error}")


def transform(limit: int | None = None, restart: bool = False, model: str | None = None) -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit(
            "ANTHROPIC_API_KEY is not set -- add it to etl/.env (see .env.example). "
            "Get one at console.anthropic.com."
        )
    model = model or os.environ.get("ETL_MODEL")
    if not model:
        sys.exit(
            "Set ETL_MODEL in etl/.env to a model id your API key has access to "
            "(see console.anthropic.com/settings/models -- pick a fast/cheap one, this makes ~663 calls)."
        )

    client = Anthropic(api_key=api_key)
    books = json.load(open(EXTRACTED_PATH))

    themes: dict = {} if restart else (json.load(open(THEMES_PATH)) if THEMES_PATH.exists() else {})
    vocab = Vocabulary()
    vocab.seed_from_themes(themes)

    todo = [b for b in books if b["title"] not in themes]
    if limit:
        todo = todo[:limit]

    print(f"{len(themes)} books already done, {len(todo)} to go" + (f" (limited to {limit})" if limit else ""))

    for i, book in enumerate(todo, start=1):
        if not book["video_script"]:
            print(f"  [{i}/{len(todo)}] skip {book['title']!r} -- no video script")
            continue
        try:
            themes[book["title"]] = transform_one(client, model, book, vocab)
        except RuntimeError as e:
            print(f"  [{i}/{len(todo)}] FAILED {book['title']!r}: {e}")
            continue

        print(
            f"  [{i}/{len(todo)}] {book['title']!r} -> {themes[book['title']]['genre']}, "
            f"{len(themes[book['title']]['topics'])} topics"
        )

        # Write after every book, not just at the end -- a run this long
        # will get interrupted sooner or later, and losing zero completed
        # work on restart matters more here than the extra disk I/O costs.
        with open(THEMES_PATH, "w") as f:
            json.dump(themes, f, indent=2)
        if vocab.merge_log:
            with open(MERGE_LOG_PATH, "w") as f:
                json.dump(vocab.merge_log, f, indent=2)

    print(f"Done. {len(themes)} of {len(books)} books now have theme data.")
    if vocab.merge_log:
        print(f"{len(vocab.merge_log)} fuzzy topic/genre merges -- review {MERGE_LOG_PATH}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, default=None, help="Only process the first N not-yet-done books (for a cheap test run)"
    )
    parser.add_argument("--restart", action="store_true", help="Ignore any existing themes.json and start over from scratch")
    parser.add_argument("--model", type=str, default=None, help="Override ETL_MODEL from .env")
    args = parser.parse_args()
    transform(limit=args.limit, restart=args.restart, model=args.model)


if __name__ == "__main__":
    main()
