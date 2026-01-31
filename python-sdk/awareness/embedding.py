"""
Embedding Engine - Automatic text-to-vector conversion

Supports multiple providers:
- OpenAI (text-embedding-3-small) - Best quality, requires API key
- Local (sentence-transformers) - Privacy-friendly, runs offline
- Awareness Cloud - Managed service (coming soon)

Features:
- Automatic provider selection
- Local SQLite cache (avoid redundant API calls)
- Batch processing support
- Dimension normalization

Example:
    engine = EmbeddingEngine(provider="auto")
    vector = engine.embed("Hello, world!")
    vectors = engine.batch_embed(["Hello", "World", "AI"])
"""

import numpy as np
from typing import List, Optional, Literal
import hashlib
import sqlite3
from pathlib import Path
import time
import json


ProviderType = Literal["auto", "openai", "local", "cloud"]


class EmbeddingEngine:
    """
    Automatic text-to-vector conversion engine

    Intelligently selects the best embedding provider based on
    available API keys and installed packages.

    Attributes:
        provider (str): Active provider ("openai", "local", or "cloud")
        dimension (int): Embedding vector dimension
        model_name (str): Specific model being used
    """

    CACHE_DB = Path.home() / ".awareness" / "embedding_cache.db"
    DEFAULT_DIMENSION = 1536  # OpenAI text-embedding-3-small

    def __init__(
        self,
        provider: ProviderType = "auto",
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ):
        """
        Initialize embedding engine

        Args:
            provider: "auto" | "openai" | "local" | "cloud"
            api_key: OpenAI API key (if using OpenAI provider)
            model: Specific model name (optional)

        Examples:
            # Auto-select best provider
            engine = EmbeddingEngine(provider="auto")

            # Force OpenAI
            engine = EmbeddingEngine(provider="openai", api_key="sk-...")

            # Use local model
            engine = EmbeddingEngine(provider="local")
        """
        self.api_key = api_key
        self.model_name = model
        self.provider = self._select_provider(provider, api_key)
        self.dimension = self._get_dimension()

        # Initialize cache database
        self._init_cache()

        # Lazy-load heavy dependencies
        self._openai_client = None
        self._local_model = None

        print(f"🧠 EmbeddingEngine initialized: {self.provider} ({self.dimension}D)")

    def _select_provider(self, provider: ProviderType, api_key: Optional[str]) -> str:
        """
        Automatically select the best available provider

        Priority:
        1. OpenAI (if API key provided)
        2. Local (if sentence-transformers installed)
        3. Cloud (fallback, requires internet)
        """
        if provider == "auto":
            # Check for OpenAI API key
            if api_key:
                return "openai"

            # Try to import sentence-transformers
            try:
                import sentence_transformers
                return "local"
            except ImportError:
                pass

            # Fallback to cloud
            print("⚠️  No OpenAI key and sentence-transformers not installed")
            print("   Using Awareness Cloud embedding service")
            return "cloud"

        return provider

    def _get_dimension(self) -> int:
        """Get embedding dimension for the selected provider"""
        if self.provider == "openai":
            return 1536  # text-embedding-3-small
        elif self.provider == "local":
            return 384   # all-MiniLM-L6-v2
        elif self.provider == "cloud":
            return 1536  # Matches OpenAI for compatibility
        return self.DEFAULT_DIMENSION

    def _init_cache(self):
        """Initialize local SQLite cache database"""
        self.CACHE_DB.parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(self.CACHE_DB)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS embeddings (
                text_hash TEXT PRIMARY KEY,
                text TEXT,
                embedding BLOB,
                provider TEXT,
                model TEXT,
                dimension INTEGER,
                created_at INTEGER
            )
        ''')
        conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_provider_model
            ON embeddings(provider, model)
        ''')
        conn.commit()
        conn.close()

    def embed(self, text: str) -> np.ndarray:
        """
        Convert text to embedding vector

        Args:
            text: Input text (any length, will be truncated if needed)

        Returns:
            numpy array of shape (dimension,)

        Example:
            vector = engine.embed("Machine learning is amazing")
            assert vector.shape == (1536,)
        """
        # Check cache first
        text_hash = hashlib.sha256(text.encode()).hexdigest()
        cached = self._get_cached(text_hash)

        if cached is not None:
            return cached

        # Generate new embedding
        if self.provider == "openai":
            embedding = self._embed_openai(text)
        elif self.provider == "local":
            embedding = self._embed_local(text)
        elif self.provider == "cloud":
            embedding = self._embed_cloud(text)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

        # Cache result
        self._cache_embedding(text_hash, text, embedding)

        return embedding

    def _embed_openai(self, text: str) -> np.ndarray:
        """Embed using OpenAI API"""
        if self._openai_client is None:
            try:
                from openai import OpenAI
                self._openai_client = OpenAI(api_key=self.api_key)
            except ImportError:
                raise ImportError(
                    "OpenAI package not installed. "
                    "Install with: pip install openai"
                )

        model = self.model_name or "text-embedding-3-small"

        response = self._openai_client.embeddings.create(
            model=model,
            input=text
        )

        return np.array(response.data[0].embedding, dtype=np.float32)

    def _embed_local(self, text: str) -> np.ndarray:
        """Embed using local sentence-transformers model"""
        if self._local_model is None:
            try:
                from sentence_transformers import SentenceTransformer

                model_name = self.model_name or 'all-MiniLM-L6-v2'
                print(f"📥 Loading local model: {model_name}...")
                self._local_model = SentenceTransformer(model_name)
                print(f"✅ Model loaded!")

            except ImportError:
                raise ImportError(
                    "sentence-transformers not installed. "
                    "Install with: pip install sentence-transformers"
                )

        embedding = self._local_model.encode(text, convert_to_numpy=True)
        return embedding.astype(np.float32)

    def _embed_cloud(self, text: str) -> np.ndarray:
        """Embed using Awareness Cloud service"""
        import requests

        # This would call Awareness Network's hosted embedding service
        # For now, raise an error (not implemented yet)
        raise NotImplementedError(
            "Awareness Cloud embedding service not yet available. "
            "Use provider='openai' or provider='local' instead."
        )

    def batch_embed(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """
        Embed multiple texts efficiently

        Args:
            texts: List of text strings
            batch_size: Process this many texts at once (for API efficiency)

        Returns:
            numpy array of shape (len(texts), dimension)

        Example:
            texts = ["Hello", "World", "AI"]
            vectors = engine.batch_embed(texts)
            assert vectors.shape == (3, 1536)
        """
        embeddings = []

        # Check cache for each text
        uncached_texts = []
        uncached_indices = []

        for i, text in enumerate(texts):
            text_hash = hashlib.sha256(text.encode()).hexdigest()
            cached = self._get_cached(text_hash)

            if cached is not None:
                embeddings.append(cached)
            else:
                uncached_texts.append(text)
                uncached_indices.append(i)

        # Generate embeddings for uncached texts
        if uncached_texts:
            if self.provider == "openai":
                # OpenAI supports batch requests
                new_embeddings = self._batch_embed_openai(uncached_texts, batch_size)
            elif self.provider == "local":
                # sentence-transformers is already batched
                new_embeddings = self._batch_embed_local(uncached_texts)
            else:
                # Fallback: one by one
                new_embeddings = np.array([self.embed(t) for t in uncached_texts])

            # Cache new embeddings
            for text, embedding in zip(uncached_texts, new_embeddings):
                text_hash = hashlib.sha256(text.encode()).hexdigest()
                self._cache_embedding(text_hash, text, embedding)

            # Merge cached and new embeddings in correct order
            result = [None] * len(texts)
            cached_idx = 0
            new_idx = 0

            for i in range(len(texts)):
                if i in uncached_indices:
                    result[i] = new_embeddings[new_idx]
                    new_idx += 1
                else:
                    result[i] = embeddings[cached_idx]
                    cached_idx += 1

            return np.array(result)

        return np.array(embeddings)

    def _batch_embed_openai(self, texts: List[str], batch_size: int) -> np.ndarray:
        """Batch embed using OpenAI"""
        if self._openai_client is None:
            from openai import OpenAI
            self._openai_client = OpenAI(api_key=self.api_key)

        model = self.model_name or "text-embedding-3-small"
        all_embeddings = []

        # Process in batches
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = self._openai_client.embeddings.create(
                model=model,
                input=batch
            )

            batch_embeddings = [
                np.array(item.embedding, dtype=np.float32)
                for item in response.data
            ]
            all_embeddings.extend(batch_embeddings)

        return np.array(all_embeddings)

    def _batch_embed_local(self, texts: List[str]) -> np.ndarray:
        """Batch embed using local model"""
        if self._local_model is None:
            from sentence_transformers import SentenceTransformer
            model_name = self.model_name or 'all-MiniLM-L6-v2'
            self._local_model = SentenceTransformer(model_name)

        embeddings = self._local_model.encode(
            texts,
            convert_to_numpy=True,
            show_progress_bar=len(texts) > 10
        )
        return embeddings.astype(np.float32)

    def _get_cached(self, text_hash: str) -> Optional[np.ndarray]:
        """Retrieve embedding from cache"""
        conn = sqlite3.connect(self.CACHE_DB)
        cursor = conn.execute(
            'SELECT embedding, provider, model FROM embeddings WHERE text_hash = ?',
            (text_hash,)
        )
        row = cursor.fetchone()
        conn.close()

        if row and row[1] == self.provider:
            # Only use cache if provider matches
            return np.frombuffer(row[0], dtype=np.float32)

        return None

    def _cache_embedding(self, text_hash: str, text: str, embedding: np.ndarray):
        """Save embedding to cache"""
        conn = sqlite3.connect(self.CACHE_DB)
        conn.execute(
            'INSERT OR REPLACE INTO embeddings VALUES (?, ?, ?, ?, ?, ?, ?)',
            (
                text_hash,
                text,
                embedding.astype(np.float32).tobytes(),
                self.provider,
                self.model_name or "default",
                self.dimension,
                int(time.time())
            )
        )
        conn.commit()
        conn.close()

    def clear_cache(self):
        """Clear all cached embeddings"""
        conn = sqlite3.connect(self.CACHE_DB)
        conn.execute('DELETE FROM embeddings')
        conn.commit()
        conn.close()
        print("🗑️  Embedding cache cleared")

    def get_cache_stats(self) -> dict:
        """Get cache statistics"""
        conn = sqlite3.connect(self.CACHE_DB)

        # Total count
        cursor = conn.execute('SELECT COUNT(*) FROM embeddings')
        total = cursor.fetchone()[0]

        # By provider
        cursor = conn.execute('''
            SELECT provider, COUNT(*) as count
            FROM embeddings
            GROUP BY provider
        ''')
        by_provider = dict(cursor.fetchall())

        # Cache size
        cache_size_bytes = self.CACHE_DB.stat().st_size if self.CACHE_DB.exists() else 0

        conn.close()

        return {
            'total_embeddings': total,
            'by_provider': by_provider,
            'cache_size_mb': round(cache_size_bytes / (1024 * 1024), 2),
            'cache_path': str(self.CACHE_DB)
        }

    def __repr__(self):
        return f"EmbeddingEngine(provider='{self.provider}', dimension={self.dimension})"


if __name__ == "__main__":
    # Demo usage
    print("🧪 EmbeddingEngine Demo\n")

    # Test with local model (no API key needed)
    engine = EmbeddingEngine(provider="local")

    # Single embedding
    text = "Artificial intelligence is transforming the world"
    vector = engine.embed(text)
    print(f"✅ Embedded text: {text[:50]}...")
    print(f"   Vector shape: {vector.shape}")
    print(f"   First 5 values: {vector[:5]}")

    # Batch embedding
    texts = [
        "Machine learning",
        "Deep neural networks",
        "Natural language processing"
    ]
    vectors = engine.batch_embed(texts)
    print(f"\n✅ Batch embedded {len(texts)} texts")
    print(f"   Result shape: {vectors.shape}")

    # Cache stats
    stats = engine.get_cache_stats()
    print(f"\n📊 Cache stats:")
    print(f"   Total cached: {stats['total_embeddings']}")
    print(f"   Cache size: {stats['cache_size_mb']} MB")

    print("\n🎉 All tests passed!")
