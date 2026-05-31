"""Boilerplate loader for local Qdrant collection.

Usage:
  uv run python scripts/populate_vector_db.py --input data/tickets.jsonl

Input format (JSONL):
  {"id": "ticket-123", "text": "TICKET_TEXT_V1\n...", "payload": {"kind": "ticket"}}
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.config import get_settings
from app.vector_store import LocalVectorConfig, LocalVectorStore


def _iter_jsonl(path: Path):
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        yield json.loads(line)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to JSONL file")
    args = parser.parse_args()

    settings = get_settings()
    if not settings.qdrant_url:
        raise SystemExit("QDRANT_URL must be set")

    store = LocalVectorStore(
        LocalVectorConfig(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
            collection=settings.qdrant_collection,
            embedding_model=settings.embedding_model,
        )
    )

    count = 0
    for row in _iter_jsonl(Path(args.input)):
        store.upsert_ticket_text(
            ticket_id=str(row["id"]),
            text=str(row["text"]),
            payload=row.get("payload") or {},
        )
        count += 1

    print(f"Upserted {count} vectors into {settings.qdrant_collection}")


if __name__ == "__main__":
    main()
