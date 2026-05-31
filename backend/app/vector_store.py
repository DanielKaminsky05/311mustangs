"""Local vector store client (FastEmbed + Qdrant).

MVP helper for embedding ticket text and writing/searching points in a local
Qdrant collection.
"""

from __future__ import annotations

import hashlib
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from fastembed import TextEmbedding
from qdrant_client import QdrantClient, models


@dataclass
class LocalVectorConfig:
    url: str
    api_key: str
    collection: str
    embedding_model: str


class LocalVectorStore:
    def __init__(self, cfg: LocalVectorConfig) -> None:
        self._cfg = cfg
        self._client = QdrantClient(url=cfg.url, api_key=cfg.api_key or None)
        self._embedder = TextEmbedding(model_name=cfg.embedding_model)
        self._dim: int | None = None

    def _embed(self, text: str) -> list[float]:
        vector = list(next(self._embedder.embed([text])))
        if self._dim is None:
            self._dim = len(vector)
        return vector

    def ensure_collection(self) -> None:
        if self._client.collection_exists(self._cfg.collection):
            return
        if self._dim is None:
            self._dim = len(self._embed("warmup"))
        self._client.create_collection(
            collection_name=self._cfg.collection,
            vectors_config=models.VectorParams(
                size=self._dim,
                distance=models.Distance.COSINE,
            ),
        )

    def upsert_ticket_text(
        self,
        *,
        ticket_id: str,
        text: str,
        payload: dict[str, Any] | None = None,
    ) -> None:
        self.ensure_collection()
        point_payload = dict(payload or {})
        point_payload.setdefault("sqlite_id", ticket_id)
        point_payload.setdefault(
            "structured_text_hash", f"sha256:{hashlib.sha256(text.encode()).hexdigest()}"
        )
        vector = self._embed(text)
        self._client.upsert(
            collection_name=self._cfg.collection,
            points=[
                models.PointStruct(id=ticket_id, vector=vector, payload=point_payload)
            ],
            wait=True,
        )

    def search(self, *, text: str, limit: int = 10) -> Iterable[models.ScoredPoint]:
        self.ensure_collection()
        vector = self._embed(text)
        return self._client.search(
            collection_name=self._cfg.collection,
            query_vector=vector,
            limit=limit,
        )
