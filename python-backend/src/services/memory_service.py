import json
import logging
import os
from datetime import datetime
from typing import Optional
import aiosqlite

from config.settings import settings

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(settings.VECTOR_DB_PATH, "memory.db")


class MemoryService:
    """Service for managing long-term and short-term memory."""

    def __init__(self):
        self.db_path = DB_PATH
        self._initialized = False

    async def initialize(self):
        """Initialize database tables."""
        if self._initialized:
            return

        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

        async with aiosqlite.connect(self.db_path) as db:
            # Conversation history
            await db.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Facts about the user (explicit knowledge)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS facts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    source TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(category, key)
                )
            """)

            # Conversation summaries (compressed long-term memory)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS summaries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    key_points TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Important memories to remember
            await db.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    importance INTEGER DEFAULT 5,
                    tags TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            await db.commit()

        self._initialized = True
        logger.info("Memory database initialized")

    async def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
    ):
        """Save a conversation message."""
        await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO conversations (session_id, role, content) VALUES (?, ?, ?)",
                (session_id, role, content)
            )
            await db.commit()

    async def get_conversation_history(
        self,
        session_id: str,
        limit: int = 20,
    ) -> list[dict]:
        """Get recent conversation history for a session."""
        await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """SELECT role, content, timestamp FROM conversations
                   WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?""",
                (session_id, limit)
            )
            rows = await cursor.fetchall()

        return [dict(row) for row in reversed(rows)]

    async def save_fact(
        self,
        category: str,
        key: str,
        value: str,
        source: Optional[str] = None,
    ):
        """Save or update a fact about the user."""
        await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT INTO facts (category, key, value, source, updated_at)
                   VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                   ON CONFLICT(category, key) DO UPDATE SET
                   value = excluded.value,
                   source = excluded.source,
                   updated_at = CURRENT_TIMESTAMP""",
                (category, key, value, source)
            )
            await db.commit()

        logger.info(f"Saved fact: {category}/{key}")

    async def get_facts(
        self,
        category: Optional[str] = None,
    ) -> list[dict]:
        """Get all facts, optionally filtered by category."""
        await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row

            if category:
                cursor = await db.execute(
                    "SELECT * FROM facts WHERE category = ? ORDER BY key",
                    (category,)
                )
            else:
                cursor = await db.execute(
                    "SELECT * FROM facts ORDER BY category, key"
                )

            rows = await cursor.fetchall()

        return [dict(row) for row in rows]

    async def get_facts_as_context(self) -> str:
        """Get all facts formatted as context for LLM."""
        facts = await self.get_facts()

        if not facts:
            return ""

        # Group by category
        by_category = {}
        for fact in facts:
            cat = fact["category"]
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(f"- {fact['key']}: {fact['value']}")

        # Format as text
        parts = []
        for category, items in by_category.items():
            parts.append(f"[{category}]")
            parts.extend(items)
            parts.append("")

        return "\n".join(parts)

    async def save_summary(
        self,
        session_id: str,
        summary: str,
        key_points: Optional[list[str]] = None,
    ):
        """Save a conversation summary."""
        await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO summaries (session_id, summary, key_points) VALUES (?, ?, ?)",
                (session_id, summary, json.dumps(key_points) if key_points else None)
            )
            await db.commit()

    async def get_recent_summaries(self, limit: int = 5) -> list[dict]:
        """Get recent conversation summaries."""
        await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM summaries ORDER BY created_at DESC LIMIT ?",
                (limit,)
            )
            rows = await cursor.fetchall()

        return [dict(row) for row in rows]

    async def save_memory(
        self,
        content: str,
        importance: int = 5,
        tags: Optional[list[str]] = None,
    ):
        """Save an important memory."""
        await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO memories (content, importance, tags) VALUES (?, ?, ?)",
                (content, importance, json.dumps(tags) if tags else None)
            )
            await db.commit()

    async def search_memories(
        self,
        query: str,
        limit: int = 10,
    ) -> list[dict]:
        """Search memories by content (simple LIKE search)."""
        await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """SELECT * FROM memories
                   WHERE content LIKE ?
                   ORDER BY importance DESC, created_at DESC
                   LIMIT ?""",
                (f"%{query}%", limit)
            )
            rows = await cursor.fetchall()

        return [dict(row) for row in rows]

    async def delete_fact(self, category: str, key: str) -> bool:
        """Delete a specific fact."""
        await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM facts WHERE category = ? AND key = ?",
                (category, key)
            )
            await db.commit()
            return cursor.rowcount > 0

    async def clear_all(self):
        """Clear all memory data (dangerous!)."""
        await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM conversations")
            await db.execute("DELETE FROM facts")
            await db.execute("DELETE FROM summaries")
            await db.execute("DELETE FROM memories")
            await db.commit()

        logger.warning("All memory data cleared")


memory_service = MemoryService()
