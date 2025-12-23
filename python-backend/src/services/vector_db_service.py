import json
import logging
import os
from typing import List, Optional
import numpy as np

from config.settings import settings
from src.models.schemas import DocumentChunk

logger = logging.getLogger(__name__)


class VectorDBService:
    def __init__(self):
        self.dimension = settings.EMBEDDING_DIMENSION
        self.index = None
        self.documents: List[DocumentChunk] = []
        self.db_path = settings.VECTOR_DB_PATH
        self._initialize()

    def _initialize(self):
        """Initialize FAISS index."""
        try:
            import faiss

            # Create a flat L2 index
            self.index = faiss.IndexFlatL2(self.dimension)

            # Load existing data if available
            self._load_from_disk()

            logger.info(f"VectorDB initialized with dimension {self.dimension}")
        except Exception as e:
            logger.error(f"VectorDB initialization error: {e}")
            raise

    def add_document(self, chunk: DocumentChunk) -> str:
        """Add a document chunk to the vector store."""
        if chunk.embedding is None:
            raise ValueError("Document chunk must have an embedding")

        embedding = np.array([chunk.embedding], dtype=np.float32)
        self.index.add(embedding)
        self.documents.append(chunk)

        logger.info(f"Added document: {chunk.id}")
        return chunk.id

    def add_documents(self, chunks: List[DocumentChunk]) -> List[str]:
        """Add multiple document chunks to the vector store."""
        ids = []
        embeddings = []

        for chunk in chunks:
            if chunk.embedding is None:
                raise ValueError(f"Document chunk {chunk.id} must have an embedding")
            embeddings.append(chunk.embedding)
            self.documents.append(chunk)
            ids.append(chunk.id)

        embeddings_array = np.array(embeddings, dtype=np.float32)
        self.index.add(embeddings_array)

        logger.info(f"Added {len(chunks)} documents")
        return ids

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
    ) -> List[DocumentChunk]:
        """Search for similar documents."""
        if self.index.ntotal == 0:
            return []

        query = np.array([query_embedding], dtype=np.float32)
        distances, indices = self.index.search(query, min(top_k, self.index.ntotal))

        results = []
        for idx in indices[0]:
            if idx >= 0 and idx < len(self.documents):
                results.append(self.documents[idx])

        return results

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document by ID (requires index rebuild)."""
        # Find and remove document
        doc_idx = None
        for i, doc in enumerate(self.documents):
            if doc.id == doc_id:
                doc_idx = i
                break

        if doc_idx is None:
            return False

        self.documents.pop(doc_idx)
        self._rebuild_index()

        logger.info(f"Deleted document: {doc_id}")
        return True

    def _rebuild_index(self):
        """Rebuild FAISS index from documents."""
        import faiss

        self.index = faiss.IndexFlatL2(self.dimension)

        if self.documents:
            embeddings = [doc.embedding for doc in self.documents if doc.embedding]
            if embeddings:
                embeddings_array = np.array(embeddings, dtype=np.float32)
                self.index.add(embeddings_array)

    def save_to_disk(self):
        """Persist vector store to disk."""
        import faiss

        os.makedirs(self.db_path, exist_ok=True)

        # Save FAISS index
        index_path = os.path.join(self.db_path, "index.faiss")
        faiss.write_index(self.index, index_path)

        # Save documents metadata
        docs_path = os.path.join(self.db_path, "documents.json")
        docs_data = [
            {
                "id": doc.id,
                "content": doc.content,
                "embedding": doc.embedding,
                "metadata": doc.metadata,
            }
            for doc in self.documents
        ]
        with open(docs_path, "w", encoding="utf-8") as f:
            json.dump(docs_data, f, ensure_ascii=False, indent=2)

        logger.info(f"Saved {len(self.documents)} documents to disk")

    def _load_from_disk(self):
        """Load vector store from disk if exists."""
        import faiss

        index_path = os.path.join(self.db_path, "index.faiss")
        docs_path = os.path.join(self.db_path, "documents.json")

        if os.path.exists(index_path) and os.path.exists(docs_path):
            try:
                self.index = faiss.read_index(index_path)

                with open(docs_path, "r", encoding="utf-8") as f:
                    docs_data = json.load(f)

                self.documents = [
                    DocumentChunk(
                        id=doc["id"],
                        content=doc["content"],
                        embedding=doc["embedding"],
                        metadata=doc.get("metadata", {}),
                    )
                    for doc in docs_data
                ]

                logger.info(f"Loaded {len(self.documents)} documents from disk")
            except Exception as e:
                logger.warning(f"Could not load from disk: {e}")

    def get_stats(self) -> dict:
        """Get vector store statistics."""
        return {
            "total_documents": len(self.documents),
            "index_size": self.index.ntotal if self.index else 0,
            "dimension": self.dimension,
        }

    def clear(self):
        """Clear all documents from the store."""
        import faiss

        self.index = faiss.IndexFlatL2(self.dimension)
        self.documents = []
        logger.info("Vector store cleared")


vector_db_service = VectorDBService()
